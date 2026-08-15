%% ===================================================================
%  PHASE 2a (v2): DEPLOYABLE DECISION TREE + FULL METRICS + JSON EXPORT
%
%  Run AFTER enose_phase1_analysis.m (needs enose_features_aggregated.csv
%  in the working directory).
%
%  WHAT'S NEW vs v1:
%  - Honest cross-validated confusion matrix + per-class precision,
%    recall, F1, and accuracy (the thing that was missing last time).
%  - Exports the tree as JSON (treeToJSON.m) instead of baked-in C, so
%    the ESP32 can load a retrained model without ever being reflashed.
%    See 6th_Draft.ino's generic tree interpreter + /update-model route.
%  - Optional: auto-push the new model straight to the device over WiFi
%    if your laptop is already connected to the ESP32's access point.
%
%  WHY A SEPARATE, SIMPLER MODEL THAN THE PHASE 1 RANDOM FOREST:
%  Your 4 classes are perfectly confounded with calendar day (Fresh=Day0,
%  Slightly Aged=Day2, Moderately Spoiled=Day4, Highly Spoiled=Day6).
%  Humidity_mean/Temperature_mean are therefore excluded from training so
%  the model isn't secretly a day-of-week detector. Expect honest
%  accuracy in the 50-65% range until that confound is fixed at the data
%  collection stage (interleave classes across days, don't block them).
% ===================================================================

clear; clc; close all;

%% ---------------- CONFIG ----------------
FEATURES_CSV   = "enose_features_aggregated.csv";
CLASS_ORDER    = ["Fresh","Slightly Aged","Moderately Spoiled","Highly Spoiled"];
RNG_SEED       = 42;
MAX_DEPTH_GRID = 2:5;
OUT_JSON_FILE  = "enose_tree_model.json";

% Set to true ONLY if your laptop is currently connected to the
% E-NOSE_ESP32 WiFi access point (192.168.4.1). Leave false otherwise --
% it will just fail to connect and the script will continue regardless.
AUTO_PUSH_TO_DEVICE = true;
DEVICE_UPDATE_URL   = "http://192.168.4.1/update-model";

rng(RNG_SEED);

%% ---------------- LOAD FEATURES, DROP CONFOUNDED COLUMNS ----------------
featTable = readtable(FEATURES_CSV);
featTable.Class = categorical(featTable.Class, CLASS_ORDER);

allFeatCols = featTable.Properties.VariableNames( ...
    endsWith(featTable.Properties.VariableNames, ...
    ["_mean","_std","_peak","_base","_delta","_auc","_slope"]));
sensorFeatCols = allFeatCols(~startsWith(allFeatCols, ["Humidity","Temperature"]));

X = table2array(featTable(:, sensorFeatCols));
y = featTable.Class;

fprintf("Training on %d sensor-only features (Humidity/Temperature excluded).\n", numel(sensorFeatCols));

%% ---------------- DEPTH SWEEP (HONEST CV) ----------------
cvAcc = zeros(size(MAX_DEPTH_GRID));
for i = 1:numel(MAX_DEPTH_GRID)
    d = MAX_DEPTH_GRID(i);
    cvPartModel = crossval(fitctree(X, y, 'MaxNumSplits', 2^d - 1, 'PredictorNames', sensorFeatCols), 'KFold', 5);
    cvAcc(i) = 1 - kfoldLoss(cvPartModel);
    fprintf("MaxDepth~%d (MaxNumSplits=%d): 5-fold CV acc = %.1f%%\n", d, 2^d-1, cvAcc(i)*100);
end

[bestAcc, bestIdx] = max(cvAcc);
bestDepth = MAX_DEPTH_GRID(bestIdx);
fprintf("\nSelected MaxNumSplits=%d (best honest CV accuracy: %.1f%%)\n", 2^bestDepth-1, bestAcc*100);

%% ---------------- FIT FINAL TREE ----------------
finalTree = fitctree(X, y, 'MaxNumSplits', 2^bestDepth - 1, 'PredictorNames', sensorFeatCols);
trainAcc = mean(predict(finalTree, X) == y);

figure('Name', 'Deployable Decision Tree');
view(finalTree, 'Mode', 'graph');

%% ---------------- HONEST CV CONFUSION MATRIX + PRECISION/RECALL/F1 ----------------
% Uses out-of-fold predictions (each sample predicted by a tree that never
% saw it), which is the fair number -- training accuracy alone hides
% overfitting on a dataset this small.
cvModelFinal = crossval(fitctree(X, y, 'MaxNumSplits', 2^bestDepth - 1, 'PredictorNames', sensorFeatCols), 'KFold', 5);
yCVPred = kfoldPredict(cvModelFinal);

figure('Name', 'Phase 2 Tree - CV Confusion Matrix');
confusionchart(y, yCVPred, ...
    'Title', sprintf('Deployable Tree - 5-Fold CV Confusion Matrix (Acc: %.1f%%)', bestAcc*100), ...
    'RowSummary', 'row-normalized', 'ColumnSummary', 'column-normalized');
saveas(gcf, 'phase2_confusion_matrix.png');

cm = confusionmat(y, yCVPred, 'Order', categorical(CLASS_ORDER, CLASS_ORDER));
precision = diag(cm) ./ sum(cm, 1)';
recall    = diag(cm) ./ sum(cm, 2);
f1        = 2 * (precision .* recall) ./ (precision + recall);
precision(isnan(precision)) = 0; recall(isnan(recall)) = 0; f1(isnan(f1)) = 0;

metricsTable = table(CLASS_ORDER', precision, recall, f1, ...
    'VariableNames', {'Class','Precision','Recall','F1Score'});
disp(metricsTable);

macroF1 = mean(f1);
fprintf("\nOverall CV accuracy: %.1f%%\n", bestAcc*100);
fprintf("Macro-average F1:    %.3f\n", macroF1);
fprintf("(Training accuracy %.1f%% is shown for reference only -- the CV\n", trainAcc*100);
fprintf(" numbers above are the realistic field expectation.)\n");

writetable(metricsTable, "phase2_classification_report.csv");

%% ---------------- EXPORT MODEL AS JSON (NO REFLASH NEEDED TO UPDATE) ----------------
treeToJSON(finalTree, OUT_JSON_FILE, CLASS_ORDER);

if AUTO_PUSH_TO_DEVICE
    try
        opts = weboptions('MediaType', 'application/json', 'Timeout', 10);
        jsonBody = fileread(OUT_JSON_FILE);
        response = webwrite(DEVICE_UPDATE_URL, jsonBody, opts);
        fprintf("Model pushed to device. Response: %s\n", response);
    catch ME
        warning("Could not push model to device automatically (%s). " + ...
            "Connect your laptop to the E-NOSE_ESP32 WiFi first, or push manually.", ME.message);
    end
end

fprintf("\n=== PHASE 2a COMPLETE ===\n");
fprintf("%s is ready. Either:\n", OUT_JSON_FILE);
fprintf("  (a) POST it to http://192.168.4.1/update-model while connected to the\n");
fprintf("      E-NOSE_ESP32 WiFi (curl, Postman, or set AUTO_PUSH_TO_DEVICE=true above), or\n");
fprintf("  (b) copy it onto the ESP32's SPIFFS as /model.json before first boot.\n");
fprintf("No recompiling or reflashing required either way.\n");
