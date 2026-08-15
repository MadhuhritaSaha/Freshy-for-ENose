// =======================================================
// Electronic Nose - Onion Freshness Web & OLED System
// Broadcasting AP: E-NOSE_ESP32 (192.168.4.1)
// PHASE 2 (HYBRID, v2): Generic on-device decision tree interpreter.
//
// KEY DIFFERENCE FROM 5th_Draft.ino: the tree structure is no longer
// compiled into the firmware. It is loaded at boot from /model.json on
// SPIFFS (or a built-in fallback if that file doesn't exist yet), and
// can be REPLACED AT ANY TIME by POSTing a new model JSON to
// http://192.168.4.1/update-model -- no USB cable, no recompiling.
//
// Workflow after this firmware is flashed ONCE:
//   1. Collect more data -> re-run enose_phase1_analysis.m then
//      enose_phase2_traintree.m in MATLAB.
//   2. That produces enose_tree_model.json.
//   3. Connect your laptop to the E-NOSE_ESP32 WiFi.
//   4. POST the JSON file to http://192.168.4.1/update-model
//      (curl -X POST --data-binary @enose_tree_model.json
//       http://192.168.4.1/update-model)
//      -- or set AUTO_PUSH_TO_DEVICE=true in the MATLAB script to do
//      this automatically at the end of training.
//   5. The device reloads the new model immediately. No reboot needed.
//
// REQUIRES: ArduinoJson library (Library Manager -> "ArduinoJson", v6 or v7)
// =======================================================

#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <SPIFFS.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include "DHT.h"

// --- PIN CONFIGURATIONS ---
#define MQ135_PIN    34
#define MQ137_PIN    35
#define TGS2600_PIN  32
#define TGS2602_PIN  33
#define TGS2620_PIN  36

#define DHT11_PIN    4
#define DHTTYPE      DHT11

#define PUMP_PWM_PIN 25
#define PUMP_FG_PIN  26

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
DHT dht(DHT11_PIN, DHTTYPE);

// --- WI-FI CREDENTIALS ---
const char* ssid = "E-NOSE_ESP32";
const char* password = "12345678";

// --- SYSTEM LOGIC & VARIABLES ---
AsyncWebServer server(80);
enum SystemState { IDLE, START_REQUESTED, EVACUATING, VALVE_WAIT, LOGGING, COMPLETE };
volatile SystemState currentState = IDLE;

unsigned long stateStartTime = 0;
unsigned long lastSampleTime = 0;
const unsigned long PUMP_RUN_TIME = 90000;
const unsigned long OPERATOR_WAIT = 60000;
const unsigned long LOGGING_TIME = 60000;
const unsigned long SAMPLE_INTERVAL = 100;
const int EXPECTED_SAMPLES = LOGGING_TIME / SAMPLE_INTERVAL;
const int BASELINE_SAMPLES = max(1, EXPECTED_SAMPLES / 10);

String systemStatusStr = "IDLE";
String testResultStr = "WAITING FOR TEST";

// --- STREAMING FEATURE ACCUMULATOR (same math as Phase 1 MATLAB) --------
struct SensorFeatures {
  float mean = 0, std_ = 0, peak = 0, base = 0, delta = 0, auc = 0, slope = 0;
};

struct FeatureAccumulator {
  double sum = 0, sumSq = 0, peak = 0, baseSum = 0;
  int baseCount = 0;
  double firstVal = 0, lastVal = 0, prevVal = 0, aucSum = 0;
  int count = 0;

  void reset() {
    sum = sumSq = peak = baseSum = firstVal = lastVal = prevVal = aucSum = 0;
    baseCount = count = 0;
  }

  void update(double v) {
    if (count == 0) { firstVal = v; peak = v; }
    else { aucSum += (prevVal + v) / 2.0; if (v > peak) peak = v; }
    if (count < BASELINE_SAMPLES) { baseSum += v; baseCount++; }
    sum += v; sumSq += v * v; prevVal = v; lastVal = v; count++;
  }

  SensorFeatures finalize() const {
    SensorFeatures f;
    f.mean  = (count > 0) ? (sum / count) : 0;
    double variance = (count > 0) ? (sumSq / count - f.mean * f.mean) : 0;
    f.std_  = sqrt(max(0.0, variance));
    f.peak  = peak;
    f.base  = (baseCount > 0) ? (baseSum / baseCount) : 0;
    f.delta = f.peak - f.base;
    f.auc   = aucSum;
    f.slope = (count > 0) ? ((lastVal - firstVal) / count) : 0;
    return f;
  }
};

FeatureAccumulator accMQ135, accMQ137, accTGS2600, accTGS2602, accTGS2620;

// --- GENERIC DECISION TREE INTERPRETER -----------------------------------
// Loaded at runtime from JSON (SPIFFS /model.json, or the fallback below).
// Replacing the model means replacing this DATA, never this CODE.
#define MAX_TREE_NODES 63
#define MAX_CLASSES 8

struct TreeNode {
  bool leaf = true;
  char feature[20] = "";
  float threshold = 0;
  int left = -1, right = -1;
  int classIdx = 0;
};

TreeNode treeNodes[MAX_TREE_NODES];
int numTreeNodes = 0;
String classNames[MAX_CLASSES];
int numClasses = 0;

// Fallback model: a depth-2 tree trained on the original 60-sample
// dataset (sensor-only features). Used only if /model.json hasn't been
// pushed yet. Will be overwritten the first time you POST a real model.
const char DEFAULT_MODEL_JSON[] PROGMEM = R"json(
{
  "classNames": ["Fresh", "Slightly Aged", "Moderately Spoiled", "Highly Spoiled"],
  "root": 0,
  "nodes": [
    {"leaf": false, "feature": "MQ137_auc",   "threshold": 762796.0,    "left": 1, "right": 4},
    {"leaf": false, "feature": "TGS2600_auc", "threshold": 1913109.75,  "left": 2, "right": 3},
    {"leaf": true,  "class": 2},
    {"leaf": true,  "class": 1},
    {"leaf": false, "feature": "MQ135_peak",  "threshold": 2030.5,      "left": 5, "right": 6},
    {"leaf": true,  "class": 3},
    {"leaf": true,  "class": 0}
  ]
}
)json";

// Looks up a named feature (e.g. "MQ137_auc") against the 5 sensors' computed features.
float getFeatureValue(const String& featureName,
                       const SensorFeatures& mq135, const SensorFeatures& mq137,
                       const SensorFeatures& tgs2600, const SensorFeatures& tgs2602,
                       const SensorFeatures& tgs2620) {
  int sep = featureName.indexOf('_');
  String sensorTag = featureName.substring(0, sep);
  String stat = featureName.substring(sep + 1);

  const SensorFeatures* f;
  if (sensorTag == "MQ135") f = &mq135;
  else if (sensorTag == "MQ137") f = &mq137;
  else if (sensorTag == "TGS2600") f = &tgs2600;
  else if (sensorTag == "TGS2602") f = &tgs2602;
  else if (sensorTag == "TGS2620") f = &tgs2620;
  else { Serial.println("WARN: unknown sensor in feature " + featureName); return 0; }

  if (stat == "mean") return f->mean;
  if (stat == "std")  return f->std_;
  if (stat == "peak") return f->peak;
  if (stat == "base") return f->base;
  if (stat == "delta") return f->delta;
  if (stat == "auc")  return f->auc;
  if (stat == "slope") return f->slope;
  Serial.println("WARN: unknown stat in feature " + featureName);
  return 0;
}

int interpretTree(const SensorFeatures& mq135, const SensorFeatures& mq137,
                   const SensorFeatures& tgs2600, const SensorFeatures& tgs2602,
                   const SensorFeatures& tgs2620) {
  if (numTreeNodes == 0) return -1;
  int nodeIdx = 0;
  int guard = 0;
  while (guard++ < MAX_TREE_NODES) {
    TreeNode& node = treeNodes[nodeIdx];
    if (node.leaf) return node.classIdx;
    float val = getFeatureValue(String(node.feature), mq135, mq137, tgs2600, tgs2602, tgs2620);
    nodeIdx = (val <= node.threshold) ? node.left : node.right;
    if (nodeIdx < 0 || nodeIdx >= numTreeNodes) {
      Serial.println("ERROR: tree walk hit invalid node, aborting.");
      return -1;
    }
  }
  Serial.println("ERROR: tree walk exceeded max depth (possible cycle in model.json).");
  return -1;
}

// Parses a JSON model (from SPIFFS or the fallback string) into treeNodes[]/classNames[].
bool loadModelFromJSON(const String& jsonText) {
  DynamicJsonDocument doc(8192);
  DeserializationError err = deserializeJson(doc, jsonText);
  if (err) {
    Serial.println("Model JSON parse failed: " + String(err.c_str()));
    return false;
  }

  JsonArray classArr = doc["classNames"];
  numClasses = 0;
  for (JsonVariant v : classArr) {
    if (numClasses >= MAX_CLASSES) break;
    classNames[numClasses++] = v.as<String>();
  }

  JsonArray nodesArr = doc["nodes"];
  numTreeNodes = 0;
  for (JsonObject n : nodesArr) {
    if (numTreeNodes >= MAX_TREE_NODES) break;
    TreeNode& node = treeNodes[numTreeNodes];
    node.leaf = n["leaf"] | true;
    if (node.leaf) {
      node.classIdx = n["class"] | 0;
    } else {
      const char* featureStr = n["feature"] | "";
strncpy(node.feature, featureStr, sizeof(node.feature) - 1);
      node.threshold = n["threshold"] | 0.0f;
      node.left = n["left"] | -1;
      node.right = n["right"] | -1;
    }
    numTreeNodes++;
  }

  Serial.printf("Model loaded: %d nodes, %d classes.\n", numTreeNodes, numClasses);
  return numTreeNodes > 0 && numClasses > 0;
}

void loadModel() {
  if (SPIFFS.exists("/model.json")) {
    File f = SPIFFS.open("/model.json", FILE_READ);
    String jsonText = f.readString();
    f.close();
    if (loadModelFromJSON(jsonText)) {
      Serial.println("Loaded model from /model.json (SPIFFS).");
      return;
    }
    Serial.println("Stored /model.json was invalid -- falling back to built-in model.");
  }
  loadModelFromJSON(String(DEFAULT_MODEL_JSON));
  Serial.println("Loaded built-in fallback model.");
}

// --- WEB INTERFACE (HTML/JS/CSS) ---
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .card { background: white; max-width: 450px; margin: 30px auto; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        h2 { margin-top: 0; font-size: 24px; color: #111; }
        h3 { font-size: 14px; color: #555; margin: 15px 0 5px 0; text-transform: uppercase; letter-spacing: 1px; }
        p { font-size: 18px; font-weight: bold; color: #000; margin: 0 0 15px 0; }
        .result-box { font-size: 22px; padding: 10px; border-radius: 5px; background-color: #eee; margin-bottom: 20px; transition: all 0.3s ease; }
        .btn-group { display: flex; justify-content: center; gap: 10px; margin-bottom: 15px; }
        button { flex: 1; padding: 12px; font-size: 14px; font-weight: bold; border-radius: 5px; border: 1px solid #ccc; background: white; cursor: pointer; text-transform: uppercase; }
        button:active { background: #eee; }
        .full-width { display: block; width: 100%; margin-bottom: 10px; }
    </style>
    <script>
        setInterval(function() {
            fetch('/status').then(response => response.json()).then(data => {
                document.getElementById('status').innerText = data.status;
                let resBox = document.getElementById('result');
                resBox.innerText = data.result;
                if (data.result.includes("Fresh")) {
                    resBox.style.backgroundColor = "#d4edda"; resBox.style.color = "#155724";
                } else if (data.result.includes("Highly Spoiled")) {
                    resBox.style.backgroundColor = "#f8d7da"; resBox.style.color = "#721c24";
                } else if (data.result.includes("Moderately Spoiled") || data.result.includes("Slightly Aged")) {
                    resBox.style.backgroundColor = "#fff3cd"; resBox.style.color = "#856404";
                } else if (data.result.includes("RUNNING") || data.result.includes("WAIT") || data.result.includes("PUMPING") || data.result.includes("SAMPLING")) {
                    resBox.style.backgroundColor = "#fff3cd"; resBox.style.color = "#856404";
                } else {
                    resBox.style.backgroundColor = "#eee"; resBox.style.color = "#000";
                }
            });
        }, 500);
        function startTest() { fetch('/start'); }
        function stopTest() { fetch('/stop'); }
    </script>
</head>
<body>
    <div class="card">
        <h2>Electronic Nose</h2>
        <h3 style="color:#777; margin-bottom:20px; text-transform: none;">Onion Freshness Analyzer (4-Class)</h3>
        <h3>System Status:</h3>
        <p id="status">IDLE</p>
        <h3>Analysis Outcome:</h3>
        <div id="result" class="result-box">WAITING FOR TEST</div>
        <div class="btn-group">
            <button onclick="startTest()">Start Test</button>
            <button onclick="stopTest()">Stop Test</button>
        </div>
        <button class="full-width" style="background:#fdfdfd;" onclick="window.open('/live', '_blank')">View All Live Values</button>
        <button class="full-width" style="background:#fdfdfd;" onclick="window.location.href='/download'">Download Experiment CSV</button>
        <button class="full-width" style="background:#fdfdfd;" onclick="window.open('/model-info', '_blank')">View Loaded Model Info</button>
    </div>
</body>
</html>
)rawliteral";

// Buffer used to assemble the POSTed model JSON across multiple chunks.
String modelUploadBuffer;

void setup() {
  Serial.begin(115200);

  pinMode(MQ135_PIN, INPUT); pinMode(MQ137_PIN, INPUT);
  pinMode(TGS2600_PIN, INPUT); pinMode(TGS2602_PIN, INPUT); pinMode(TGS2620_PIN, INPUT);

  ledcAttach(PUMP_PWM_PIN, 20000, 8);
  ledcWrite(PUMP_PWM_PIN, 255);

  dht.begin();
  Wire.begin(21, 22);
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.display();
  }

  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS Mount Failed");
  }

  loadModel();   // load /model.json if present, else the built-in fallback

  WiFi.softAP(ssid, password);
  Serial.print("AP IP Address: ");
  Serial.println(WiFi.softAPIP());

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, "text/html", index_html);
  });

  server.on("/start", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (currentState == IDLE || currentState == COMPLETE) {
      File csvFile = SPIFFS.open("/data.csv", FILE_WRITE);
      if (csvFile) {
        csvFile.println("Timestamp_ms,MQ135,MQ137,TGS2600,TGS2602,TGS2620,Humidity,Temperature");
        csvFile.close();
      }
      accMQ135.reset(); accMQ137.reset(); accTGS2600.reset();
      accTGS2602.reset(); accTGS2620.reset();
      currentState = START_REQUESTED;
    }
    request->send(200, "text/plain", "OK");
  });

  server.on("/stop", HTTP_GET, [](AsyncWebServerRequest *request) {
    ledcWrite(PUMP_PWM_PIN, 255);
    currentState = COMPLETE;
    systemStatusStr = "IDLE";
    testResultStr = "TEST INTERRUPTED";
    request->send(200, "text/plain", "OK");
  });

  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{\"status\":\"" + systemStatusStr + "\",\"result\":\"" + testResultStr + "\"}";
    request->send(200, "application/json", json);
  });

  server.on("/download", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (SPIFFS.exists("/data.csv")) {
      request->send(SPIFFS, "/data.csv", "text/csv", true);
    } else {
      request->send(404, "text/plain", "No data file found.");
    }
  });

  // Lets you sanity-check, from a browser, that a model is actually loaded --
  // useful right after a /update-model push, without needing the serial monitor.
  server.on("/model-info", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{\"numNodes\":" + String(numTreeNodes) + ",\"classNames\":[";
    for (int i = 0; i < numClasses; i++) {
      json += "\"" + classNames[i] + "\"";
      if (i < numClasses - 1) json += ",";
    }
    json += "]}";
    request->send(200, "application/json", json);
  });

  // *** THE KEY NEW ROUTE: push a retrained model with zero reflashing. ***
  // curl -X POST --data-binary @enose_tree_model.json http://192.168.4.1/update-model
  server.on("/update-model", HTTP_POST,
    [](AsyncWebServerRequest *request) {
      // Final response, sent after the body handler below has run.
      if (loadModelFromJSON(modelUploadBuffer)) {
        File f = SPIFFS.open("/model.json", FILE_WRITE);
        if (f) { f.print(modelUploadBuffer); f.close(); }
        request->send(200, "text/plain", "Model updated and persisted. No reboot needed.");
      } else {
        request->send(400, "text/plain", "Model JSON invalid -- kept previous model.");
        loadModel();  // revert in-memory state to whatever was valid before
      }
      modelUploadBuffer = "";
    },
    NULL,
    [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
      if (index == 0) modelUploadBuffer = "";
      for (size_t i = 0; i < len; i++) modelUploadBuffer += (char)data[i];
    }
  );

  server.on("/live", HTTP_GET, [](AsyncWebServerRequest *request) {
    int v1 = analogRead(MQ135_PIN);   int v2 = analogRead(MQ137_PIN);
    int v3 = analogRead(TGS2600_PIN); int v4 = analogRead(TGS2602_PIN);
    int v5 = analogRead(TGS2620_PIN);
    float h = dht.readHumidity();     float t = dht.readTemperature();
    if (isnan(h)) h = 0.0; if (isnan(t)) t = 0.0;

    String liveHTML = "<html><head><meta http-equiv='refresh' content='1'>";
    liveHTML += "<style>body{font-family:Arial;padding:30px;background:#f4f4f4;} .box{background:white;padding:20px;border-radius:8px;max-width:400px;margin:0 auto;box-shadow:0 2px 4px rgba(0,0,0,0.1);}</style></head>";
    liveHTML += "<body><div class='box'><h2>E-Nose Live Arrays</h2><hr>";
    liveHTML += "<p><b>MQ-135 (NH3/Benzene):</b> " + String(v1) + "</p>";
    liveHTML += "<p><b>MQ-137 (Ammonia/Sulfur):</b> " + String(v2) + "</p>";
    liveHTML += "<p><b>TGS-2600 (General Air Volatiles):</b> " + String(v3) + "</p>";
    liveHTML += "<p><b>TGS-2602 (Spoilage/H2S compounds):</b> " + String(v4) + "</p>";
    liveHTML += "<p><b>TGS-2620 (Alcohol/Organic Vapours):</b> " + String(v5) + "</p><hr>";
    liveHTML += "<p><b>Chamber Temperature:</b> " + String(t, 1) + " &deg;C</p>";
    liveHTML += "<p><b>Chamber Humidity:</b> " + String(h, 1) + " %</p>";
    liveHTML += "</div></body></html>";
    request->send(200, "text/html", liveHTML);
  });

  server.begin();
}

void loop() {
  unsigned long currentTime = millis();
  updateOLED();

  switch (currentState) {
    case IDLE:
      break;

    case START_REQUESTED:
      stateStartTime = currentTime;
      currentState = EVACUATING;
      systemStatusStr = "EVACUATING";
      testResultStr = "90s PUMP RUNNING";
      ledcWrite(PUMP_PWM_PIN, 0);
      break;

    case EVACUATING:
      if (currentTime - stateStartTime >= PUMP_RUN_TIME) {
        ledcWrite(PUMP_PWM_PIN, 255);
        currentState = VALVE_WAIT;
        stateStartTime = currentTime;
        systemStatusStr = "VALVE OPEN WINDOW";
      } else {
        int secsRem = (PUMP_RUN_TIME - (currentTime - stateStartTime)) / 1000;
        testResultStr = "PUMPING: " + String(secsRem) + "s rem";
      }
      break;

    case VALVE_WAIT:
      if (currentTime - stateStartTime >= OPERATOR_WAIT) {
        currentState = LOGGING; stateStartTime = currentTime;
        lastSampleTime = currentTime;
        systemStatusStr = "LOGGING (10Hz)";
        testResultStr = "SAMPLING ACTIVE";
      } else {
        int waitRem = (OPERATOR_WAIT - (currentTime - stateStartTime)) / 1000;
        testResultStr = "OPEN VALVE! Wait: " + String(waitRem) + "s";
      }
      break;

    case LOGGING:
      if (currentTime - stateStartTime >= LOGGING_TIME) {
        currentState = COMPLETE; systemStatusStr = "COMPLETE";

        SensorFeatures fMQ135   = accMQ135.finalize();
        SensorFeatures fMQ137   = accMQ137.finalize();
        SensorFeatures fTGS2600 = accTGS2600.finalize();
        SensorFeatures fTGS2602 = accTGS2602.finalize();
        SensorFeatures fTGS2620 = accTGS2620.finalize();

        int classIdx = interpretTree(fMQ135, fMQ137, fTGS2600, fTGS2602, fTGS2620);
        testResultStr = (classIdx >= 0 && classIdx < numClasses) ? classNames[classIdx] : "MODEL ERROR";

        Serial.println(">>> RUN ENDED. FINAL CLASSIFICATION: " + testResultStr);
      }

      if (currentTime - lastSampleTime >= SAMPLE_INTERVAL) {
        lastSampleTime += SAMPLE_INTERVAL;
        int v1 = analogRead(MQ135_PIN);
        int v2 = analogRead(MQ137_PIN);
        int v3 = analogRead(TGS2600_PIN);
        int v4 = analogRead(TGS2602_PIN);
        int v5 = analogRead(TGS2620_PIN);
        float h = dht.readHumidity();
        float t = dht.readTemperature();
        if (isnan(h)) h = 0.0;
        if (isnan(t)) t = 0.0;

        accMQ135.update(v1); accMQ137.update(v2); accTGS2600.update(v3);
        accTGS2602.update(v4); accTGS2620.update(v5);

        Serial.printf("[10Hz] Time: %lu ms | MQ135: %4d | MQ137: %4d | TGS2600: %4d | TGS2602: %4d | TGS2620: %4d | Temp: %.1fC\n",
                       currentTime, v1, v2, v3, v4, v5, t);

        File csvFile = SPIFFS.open("/data.csv", FILE_APPEND);
        if (csvFile) {
          csvFile.printf("%lu,%d,%d,%d,%d,%d,%.2f,%.2f\n", currentTime, v1, v2, v3, v4, v5, h, t);
          csvFile.close();
        }
      }
      break;

    case COMPLETE:
      break;
  }
}

void updateOLED() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("--- E-NOSE CORE ---");
  display.setCursor(0, 10);
  display.print("Status: ");
  display.println(systemStatusStr);
  display.setCursor(0, 20);
  display.println(testResultStr.substring(0, 21));
  int v1 = analogRead(MQ135_PIN);
  int v2 = analogRead(MQ137_PIN);
  int v3 = analogRead(TGS2600_PIN);
  int v4 = analogRead(TGS2602_PIN);
  int v5 = analogRead(TGS2620_PIN);
  float t = dht.readTemperature();
  if (isnan(t)) t = 0.0;
  display.setCursor(0, 32);
  display.printf("135:%4d 137:%4d", v1, v2);
  display.setCursor(0, 42);
  display.printf("2600:%4d 2602:%4d", v3, v4);
  display.setCursor(0, 52);
  display.printf("2620:%4d Temp:%.1fC", v5, t);
  display.display();
}
