# 🧅 E-Nose: ESP32 Electronic Nose for Onion Freshness Classification

**A low-cost, standalone Electronic Nose (E-Nose) for non-destructive, multi-class onion freshness detection — MOS gas sensor array + on-device machine learning, built end-to-end for under ₹6,000 (~$72).**

> Summer Internship Project · Centre for Human-Computer Interaction (CHCI Lab), School of Computing & Electrical Engineering, **IIT Mandi** · May–July 2026
> **Author:** Madhuhrita Saha (IEM, UEM Kolkata) · **Supervisor:** Prof. Shubhajit Roy Chowdhury · **Mentor:** Vinod Shrivastava

---

## 📌 Overview

Post-harvest spoilage of onions (*Allium cepa* L.) is a major food-security and supply-chain problem in regions with weak cold-chain infrastructure, and early fungal infection often escapes visual inspection. This project delivers a complete, field-usable solution: a custom-fabricated acrylic two-chamber E-Nose that "smells" onion headspace volatiles and classifies freshness **on the device itself** — no laptop, no cloud.

- **Five-sensor MOS array** (MQ135, MQ137, TGS2600, TGS2602, TGS2620) + DHT11, read by an **ESP32** at 10 Hz
- **Automated 4-stage protocol**: chamber evacuation → manual valve headspace admission → 60 s synchronised acquisition → on-device inference
- **Self-hosted Wi-Fi web dashboard** (`192.168.4.1`) with Start/Stop control, live readings, verdict display and CSV log download
- **Decision-tree classifier** trained offline in MATLAB, deployed as a JSON node-array on flash, hot-updatable over Wi-Fi (`POST /update-model`) — no firmware reflash needed
- **Companion web app — [FreshNose](https://freshnose-223067313924.asia-southeast1.run.app)** — mirrors the dashboard and adds persistent inspection history (≥30 records), CSV export and image-based checks *(the real dashboard has no memory — FreshNose solves exactly that)*

**Deployed model performance:** 65.0% cross-validated accuracy · macro-F1 = 0.542 (honest, sensor-only feature set — see Results).

---

## 🏗️ System Architecture

![Labeled system diagram](DOCS/Hardware_E-NOSE.png)
<!-- 👆 image loads from DOCS/ — if your file has a different name there, update this one path -->

Two custom-fabricated 5 mm cast-acrylic (PMMA) chambers connected by 4 mm PTFE tubing, a Kaomer HDVP1-B12 vacuum pump (1,000 mL/min) and a manual 2-way ball valve:

| Subsystem | Details |
|---|---|
| **Sample chamber** | 75 × 75 × 87 mm (~490 cm³) — onion rests here 6 h for headspace accumulation (Parafilm-sealed lid) |
| **Sensor chamber** | 150 × 100 × 75 mm (~1,125 cm³) — houses the 5 MOS sensors + DHT11, with push-fit pneumatic inlet/outlet |
| **Gas path** | Vacuum pump (PWM-driven, GPIO 25, active-low) evacuates the sensor chamber; manual valve admits sample headspace into it |
| **Controller** | ESP32 (dual-core 240 MHz, 12-bit ADC 0–4095 counts, 802.11 b/g/n AP, SPIFFS flash storage) |
| **Local display** | SSD1306 128×64 OLED on I²C (SDA 21 / SCL 22) — live state without a browser |

📂 **All engineering documents live in [`DOCS/`](DOCS/)** — full lab report, EasyEDA PCB schematic (V1.0), drawio operation workflow, sample & sensor chamber 3D models, hardware photos, report drafts, and ML notes.

### GPIO map

| Peripheral | Pin(s) |
|---|---|
| MQ135 → ADC1 | GPIO 34 |
| MQ137 → ADC1 | GPIO 35 |
| TGS2600 → ADC1 | GPIO 32 |
| TGS2602 → ADC1 | GPIO 33 |
| TGS2620 → ADC1 | GPIO 36 (VP) |
| DHT11 (1-wire) | GPIO 4 |
| SSD1306 OLED | I²C SDA 21 · SCL 22 |
| Vacuum pump (LEDC PWM) | GPIO 25 |

---

## 🔄 Measurement Protocol

Executed fully autonomously after one tap on **Start Test** (Stop available at every stage):

1. **Evacuate** — pump runs 90 s to flush the sensor chamber to a clean baseline
2. **Headspace admission** — 60 s window during which the operator opens the manual valve; accumulated onion volatiles rush into the evacuated sensor chamber
3. **Acquire** — synchronised sampling of all 5 sensors + temp/RH at **10 Hz for 60 s** (~600 samples/channel), CSV logged to flash
4. **Infer** — on-device feature extraction → decision-tree traversal → freshness class shown on dashboard + OLED

### Sample preparation (training data)

Nasik Red bulbs from a single batch; surface-sterilised (70% ethanol), wounded + incubated at 30 °C/48 h for spoilage induction; 6 h sealed headspace. Classes = storage days: **Fresh (Day 0), Slightly Aged (Day 2), Moderately Spoiled (Day 4), Highly Spoiled (Day 6)**. Dataset: **n = 60** observations (3 bulbs × 4 classes × 5 replicates).

---

## 🤖 Machine Learning Pipeline

**Feature engineering (on-device, O(1) memory):** each 60 s window → 7 statistics per sensor — `mean, std, peak, base (first 10%), delta = peak−base, AUC (trapezoidal), slope` → **35 sensor-derived features** (+2 environmental covariates used only offline).

**Two-phase development (MATLAB):**

| Phase | Model | Result | Verdict |
|---|---|---|---|
| 1 — exploratory | Random Forest on all 37 features | 75.0% CV acc, AUC 0.903 | ❌ Not deployed — inflated by day↔class confound (each class sampled on a distinct day; temp/RH ranked top predictors) |
| 2 — deployable | **Single decision tree**, sensor-only 35 features, depth chosen by CV over MaxNumSplits ∈ {3,7,15,31} | **MaxNumSplits=7 (depth 3) → 65.0% CV acc, macro-F1 0.542** | ✅ Deployed |

PCA note: PC1+PC2+PC3 capture 76.3% of variance with visible inter-class overlap — the honest ceiling for this dataset.

**Per-class performance (out-of-fold):**

| Class | Precision | Recall | F1 |
|---|---|---|---|
| Fresh | 0.467 | 0.467 | 0.467 |
| Slightly Aged | 0.867 | 0.867 | **0.867** |
| Moderately Spoiled | 0.500 | 0.267 | 0.348 (weakest — mid-state VOCs overlap) |
| Highly Spoiled | 0.409 | 0.600 | 0.486 |

The tree splits exclusively on **MQ137_mean, MQ135_std, MQ135_peak, MQ135_slope, MQ137_peak** — the three TGS channels contribute no splits (documented limitation).

**Model-as-data deployment:** `ML/treeToJSON.m` serialises a MATLAB `ClassificationTree` into a 15-node JSON array → `POST /update-model` → ESP32 persists to SPIFFS and reloads instantly. Retraining never requires reflashing. Fallback model is compiled in for safety.

---

## 🖥️ Dashboards

- **On-device dashboard** (ESP32 AP, `192.168.4.1`): Start/Stop, live values, verdict, CSV download. No persistent memory — this was the identified gap.
- **FreshNose companion web app**: live test parity (Start/Stop, 5-channel live traces @10 Hz, ADC counts) **plus** persistent inspection history (≥30 records, survives reload), per-record & bulk CSV export, image-based freshness check (verdict-only output), onion/milk selector, Light/Dark/System themes.
  🔗 Live: https://freshnose-223067313924.asia-southeast1.run.app

---

## 📁 Repository Structure

```
Freshy-for-ENose/
│
├── README.md            ← you are here — project overview, hardware, protocol, ML results
│
├── ESP32Code.ino        ← complete ESP32 firmware: Wi-Fi AP (192.168.4.1) + self-hosted
│                           dashboard, 4-stage measurement protocol (evacuate → valve →
│                           acquire → infer), synchronised 10 Hz acquisition on 5 MOS
│                           channels + DHT11, O(1)-memory feature extraction, JSON
│                           decision-tree inference with flash fallback, /update-model
│                           hot-reload endpoint, SPIFFS CSV logging, OLED status readout
│
├── DOCS/                ← all project documentation: full lab report (34 pp), EasyEDA
│                           PCB schematic V1.0, drawio operation workflow, sample &
│                           sensor chamber 3D models (PDF), annotated hardware photos,
│                           report drafts (incl. 6th draft), ML notes (ML2 pt1)
│
├── ML/                  ← MATLAB analysis pipeline: feature extraction (7 stats × 5
│                           channels → 35 features), PCA + Random Forest exploratory
│                           benchmark, cross-validated decision-tree selection
│                           (MaxNumSplits ∈ {3,7,15,31}), treeToJSON.m exporter,
│                           deployed model.json
│
├── Web App/             ← FreshNose companion web app (Vite + React + Tailwind
│                           configuration, built with Google AI Studio Build) —
│                           dashboard parity + persistent inspection history (≥30
│                           records), per-record & bulk CSV export, image-based check
│
└── src/                 ← FreshNose TypeScript source (components, hooks, services)
    Live deployment ↗ https://freshnose-223067313924.asia-southeast1.run.app
```

---

## 🚀 Reproduce

1. **Build**: fabricate chambers (dimensions above), wire per the EasyEDA schematic in `DOCS/`, flash `ESP32Code.ino`.
2. **Test**: power on → join `ENOSE-XXXX` Wi-Fi → open `192.168.4.1` → Start Test → open valve when prompted → read verdict + download CSV.
3. **Retrain**: run `ml/` MATLAB scripts on new CSVs → export with `treeToJSON.m` → `curl -X POST http://192.168.4.1/update-model --data-binary @model.json`.

---

## ⚠️ Limitations & Future Work

- **Day↔class confound**: each class was sampled on one calendar day; environmental drift is partially inseparable from spoilage signal → 65.0% is a conservative estimate. Next: interleave classes across days, expand beyond n = 60.
- **TGS under-utilisation**: tree relies on MQ135/MQ137 only → recalibrate/re-evaluate TGS channels with baseline-correction features.
- Benchmark SVM (RBF), k-NN, shallow NN on a larger, deconfounded dataset; formalise as conference paper.

---

## 📎 Citation & Contact

If you use this work, cite the lab report: *Saha, M. (2026). Electronic Nose-Based Detection of Onion Freshness Using MOS Sensor Array and Machine Learning Classification. Summer Internship Report, SCEE, IIT Mandi.*

Author: **Madhuhrita Saha** · madhuhritasahahs@gmail.com · [LinkedIn](https://linkedin.com/in/madhuhrita-saha-b0b954272) · [ORCID 0009-0009-4946-8724](https://orcid.org/0009-0009-4946-8724)

Built at CHCI Lab, IIT Mandi.

