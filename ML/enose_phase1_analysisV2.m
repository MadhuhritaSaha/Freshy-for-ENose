%% ===================================================================
%  PHASE 1: E-NOSE OFFLINE ANALYSIS & VISUALIZATION
%  4-Class Onion Freshness Classification (Fresh / Slightly Aged /
%  Moderately Spoiled / Highly Spoiled)
%
%  Expected folder structure (edit ROOT_DIR below):
%    DATASETS/
%      ONION 1/DAY 1/o1data1.1.csv ... o1data1.5.csv
%      ONION 1/DAY 2/o1data2.1.csv ... o1data2.5.csv
%      ...
%      ONION 3/DAY 4/o3data4.1.csv ... o3data4.5.csv
%
%  CSV columns (confirmed from ESP32 firmware):
%    Timestamp_ms, MQ135, MQ137, TGS2600, TGS2602, TGS2620,
%    Humidity, Temperature
%  Each file = one 60s @10Hz exposure window (~600 rows).
% ===================================================================

clear; clc; close all;

%% ---------------- USER CONFIG ----------------
ROOT_DIR = "DATASETS";              % top-level dataset folder
ONIONS   = ["ONION 1","ONION 2","ONION 3"];
DAYS     = 1:4;                     % DAY 1..DAY 4 subfolders
REPS     = 1:5;                     % 5 replicate files per onion/day
DAY_TO_CLASS = containers.Map( ...
    {1,2,3,4}, ...
    {"Fresh","Slightly Aged","Moderately Spoiled","Highly Spoiled"});
CLASS_ORDER = ["Fresh","Slightly Aged","Moderately Spoiled","Highly Spoiled"];
SENSOR_COLS = ["MQ135","MQ137","TGS2600","TGS2602","TGS2620"];
RNG_SEED = 42;
TEST_FRACTION = 0.25;               % held-out test split (stratified)

rng(RNG_SEED);

%% ---------------- 1. LOAD + AGGREGATE 60 FILES ----------------
% Strategy: each CSV is one observation. We collapse the 600-row time
% series into a fixed-length feature vector per sensor (statistical +
% shape features over the 60s exposure window), since the 4 classes are
% about endpoint chemical signature, not the transient dynamics.

rows = {};   % cell array to grow the feature table
rowID = 0;

for oi = 1:numel(ONIONS)
    onionTag = sprintf("O%d", oi);
    for d = DAYS
        dayFolder = fullfile(ROOT_DIR, ONIONS(oi), sprintf("DAY %d", d));
        className = DAY_TO_CLASS(d);
        for r = REPS
            fname = fullfile(dayFolder, sprintf("o%ddata%d.%d.csv", oi, d, r));
            if ~isfile(fname)
                warning("Missing file: %s -- skipping.", fname);
                continue;
            end

            T = readtable(fname);
            % Defensive column check
            missingCols = setdiff([SENSOR_COLS, "Humidity", "Temperature"], T.Properties.VariableNames);
            if ~isempty(missingCols)
                warning("File %s missing columns: %s -- skipping.", fname, strjoin(missingCols, ","));
                continue;
            end

            rowID = rowID + 1;
            featRow = struct();
            featRow.SampleID   = rowID;
            featRow.Onion      = onionTag;
            featRow.Day        = d;
            featRow.Rep        = r;
            featRow.Class      = className;
            featRow.SourceFile = string(fname);

            % --- Per-sensor statistical features over the 60s window ---
            for s = 1:numel(SENSOR_COLS)
                col = SENSOR_COLS(s);
                v = double(T.(col));
                v = v(~isnan(v));

                baseN   = max(1, round(0.1 * numel(v)));   % first ~10% = baseline/purge tail
                peakV   = max(v);
                meanV   = mean(v);
                stdV    = std(v);
                baseV   = mean(v(1:baseN));
                deltaV  = peakV - baseV;                    % response amplitude
                aucV    = trapz(v);                         % integrated response (shape feature)
                slopeV  = (v(end) - v(1)) / max(1, numel(v)); % recovery/drift trend

                featRow.(col + "_mean")  = meanV;
                featRow.(col + "_std")   = stdV;
                featRow.(col + "_peak")  = peakV;
                featRow.(col + "_base")  = baseV;
                featRow.(col + "_delta") = deltaV;
                featRow.(col + "_auc")   = aucV;
                featRow.(col + "_slope") = slopeV;
            end

            % --- Environmental covariates ---
            featRow.Humidity_mean    = mean(T.Humidity);
            featRow.Temperature_mean = mean(T.Temperature);

            rows{end+1} = featRow; %#ok<SAGROW>
        end
    end
end

featTable = struct2table([rows{:}]);
fprintf("Loaded %d / 60 expected observations.\n", height(featTable));

% Persist aggregated features for reuse / inspection
writetable(featTable, "enose_features_aggregated.csv");

%% ---------------- 2. BUILD FEATURE MATRIX & LABELS ----------------
featCols = featTable.Properties.VariableNames( ...
    endsWith(featTable.Properties.VariableNames, ...
    ["_mean","_std","_peak","_base","_delta","_auc","_slope"]));
% include environmental covariates too
featCols = [featCols, "Humidity_mean", "Temperature_mean"];

X = featTable(:, featCols);
X = table2array(X);
y = categorical(featTable.Class, CLASS_ORDER);   % fix class order for plots

% Standardize features (z-score) -- store mu/sigma for Phase 2 deployment
[Xz, mu, sigma] = zscore(X);
sigma(sigma == 0) = 1; % guard against div-by-zero on constant columns

%% ---------------- 3. TRAIN / TEST SPLIT (STRATIFIED) ----------------
cv = cvpartition(y, 'HoldOut', TEST_FRACTION, 'Stratify', true);
XTrain = Xz(training(cv), :);  yTrain = y(training(cv));
XTest  = Xz(test(cv), :);      yTest  = y(test(cv));

fprintf("Train: %d samples | Test: %d samples\n", numel(yTrain), numel(yTest));

%% ---------------- 4. PCA ----------------
[coeff, score, ~, ~, explained] = pca(Xz);

figure('Name','PCA - 2D');
gscatter(score(:,1), score(:,2), y);
xlabel(sprintf('PC1 (%.1f%% var)', explained(1)));
ylabel(sprintf('PC2 (%.1f%% var)', explained(2)));
title('E-Nose PCA: PC1 vs PC2 by Freshness Class');
grid on;
saveas(gcf, 'pca_2d.png');

figure('Name','PCA - 3D');
colorsList = lines(numel(CLASS_ORDER));
hold on;
for c = 1:numel(CLASS_ORDER)
    idx = (y == CLASS_ORDER(c));
    scatter3(score(idx,1), score(idx,2), score(idx,3), 50, ...
        colorsList(c,:), 'filled', 'DisplayName', char(CLASS_ORDER(c)));
end
hold off;
xlabel(sprintf('PC1 (%.1f%%)', explained(1)));
ylabel(sprintf('PC2 (%.1f%%)', explained(2)));
zlabel(sprintf('PC3 (%.1f%%)', explained(3)));
title('E-Nose PCA: 3D Class Separation');
legend('Location','best');
grid on; view(45,25);
saveas(gcf, 'pca_3d.png');

fprintf("Variance explained by first 3 PCs: %.1f%%\n", sum(explained(1:3)));

%% ---------------- 5. TRAIN CLASSIFIER (RANDOM FOREST) ----------------
% Bagged trees = MATLAB's Random Forest equivalent (TreeBagger / fitcensemble)
numTrees = 150;
rfModel = fitcensemble(XTrain, yTrain, ...
    'Method', 'Bag', ...
    'NumLearningCycles', numTrees, ...
    'Learners', templateTree('MaxNumSplits', 20));

[yPred, yScores] = predict(rfModel, XTest);
% yScores columns correspond to rfModel.ClassNames order
classNames = rfModel.ClassNames;

testAcc = mean(yPred == yTest);
fprintf("Random Forest Test Accuracy: %.2f%%\n", testAcc * 100);

% --- Cross-validated accuracy (more robust given small N) ---
cvModel = fitcensemble(Xz, y, 'Method', 'Bag', ...
    'NumLearningCycles', numTrees, ...
    'Learners', templateTree('MaxNumSplits', 20), ...
    'CrossVal', 'on', 'KFold', 5);
cvAcc = 1 - kfoldLoss(cvModel);
fprintf("5-Fold Cross-Validated Accuracy: %.2f%%\n", cvAcc * 100);

%% ---------------- 6. CONFUSION MATRIX ----------------
figure('Name','Confusion Matrix');
cm = confusionchart(yTest, yPred, ...
    'Title', sprintf('4-Class Confusion Matrix (Test Acc: %.1f%%)', testAcc*100), ...
    'RowSummary', 'row-normalized', ...
    'ColumnSummary', 'column-normalized');
saveas(gcf, 'confusion_matrix.png');

%% ---------------- 7. ROC / AUC CURVES (ONE-VS-REST, 4 CLASSES) ----------------
figure('Name','ROC Curves');
hold on;
aucVals = zeros(1, numel(classNames));
for c = 1:numel(classNames)
    binaryLabels = double(yTest == classNames(c));
    [rocX, rocY, ~, aucVal] = perfcurve(binaryLabels, yScores(:,c), 1);
    plot(rocX, rocY, 'LineWidth', 2, ...
        'DisplayName', sprintf('%s (AUC = %.3f)', char(classNames(c)), aucVal));
    aucVals(c) = aucVal;
end
plot([0 1], [0 1], 'k--', 'HandleVisibility', 'off');
hold off;
xlabel('False Positive Rate'); ylabel('True Positive Rate');
title('One-vs-Rest ROC Curves (4 Classes)');
legend('Location','southeast'); grid on;
saveas(gcf, 'roc_curves.png');

fprintf("Macro-average AUC: %.3f\n", mean(aucVals));

%% ---------------- 8. RADAR PLOT: AVG SENSOR FOOTPRINT PER CLASS (fixed) ----
% Recompute radarData and normalized values to ensure variable exists
deltaCols = SENSOR_COLS + "_delta";
radarData = zeros(numel(CLASS_ORDER), numel(SENSOR_COLS));
for c = 1:numel(CLASS_ORDER)
    classMask = (featTable.Class == CLASS_ORDER(c));
    for s = 1:numel(SENSOR_COLS)
        radarData(c, s) = mean(featTable.(deltaCols(s))(classMask));
    end
end

% Normalize each sensor axis to [0,1] across classes for visual comparability
radarMin = min(radarData, [], 1);
radarMax = max(radarData, [], 1);
radarRange = radarMax - radarMin + 1e-9;        % guard vs zero-range
radarNorm = (radarData - radarMin) ./ radarRange;

% Plot on polar axes
figure('Name','Radar Plot - Sensor Footprint');
t = tiledlayout(1,1);
nexttile;
ax = polaraxes(t);
hold(ax, 'on');

theta = linspace(0, 2*pi, numel(SENSOR_COLS)+1);   % wrap-around angle (last = first)
colorsList = lines(numel(CLASS_ORDER));

for c = 1:numel(CLASS_ORDER)
    rVals = [radarNorm(c, :), radarNorm(c, 1)];    % close the loop
    p = polarplot(ax, theta, rVals, '-o', 'LineWidth', 2, ...
        'Color', colorsList(c,:), 'DisplayName', char(CLASS_ORDER(c)));
    p.MarkerFaceColor = colorsList(c,:);
end

% Configure labels and legend
thetaticks(rad2deg(theta(1:end-1)));
thetaticklabels(cellstr(SENSOR_COLS));
ax.ThetaLim = [0 360];
title(ax, 'Average Normalized Sensor Response (\Delta) Footprint by Class');
legend(ax, 'Location', 'southoutside', 'Orientation', 'horizontal');
hold(ax, 'off');

saveas(gcf, 'radar_plot.png');
% NOTE: "Highly Spoiled" reading near-zero on every axis is NOT a plotting
% bug. Min-max normalization is per-sensor; Highly Spoiled happens to have
% the lowest mean delta on every single sensor in this batch, so it sits
% at the center on every spoke. That itself is a red flag worth
% investigating physically -- decaying onions are generally expected to
% emit MORE VOCs, not less. Check for ADC saturation (TGS sensors hitting
% the 4095 ceiling on Fresh/Slightly Aged, compressing their dynamic
% range) and the day/humidity confound discussed in Phase 2 before
% trusting this plot's class ordering.

%% ---------------- 9. SAVE MODEL + PREPROCESSING FOR REUSE ----------------
save('enose_phase1_model.mat', 'rfModel', 'mu', 'sigma', 'coeff', ...
     'featCols', 'CLASS_ORDER');

fprintf("\n=== PHASE 1 COMPLETE ===\n");
fprintf("Outputs saved: enose_features_aggregated.csv, pca_2d.png, pca_3d.png,\n");
fprintf("confusion_matrix.png, roc_curves.png, radar_plot.png, enose_phase1_model.mat\n");

