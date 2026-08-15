function treeToJSON(tree, outFile, classOrder)
% TREETOJSON  Export a MATLAB ClassificationTree as a generic JSON node list.
%
%   treeToJSON(tree, "model.json", CLASS_ORDER)
%
% Unlike treeToC.m (which bakes thresholds into compiled C, requiring a
% reflash every retrain), this produces a small data file the ESP32 can
% read and act on directly via a generic tree-walking interpreter -- see
% the interpretTree() function in the firmware. To deploy a retrained
% model, POST this file to http://192.168.4.1/update-model. No
% recompiling, no USB cable, no reflash.
%
% JSON shape:
% {
%   "classNames": ["Fresh", "Slightly Aged", ...],
%   "nodes": [
%     {"feature": "MQ137_mean", "threshold": 1273.34, "left": 1, "right": 2},
%     {"leaf": true, "class": 0},
%     ...
%   ]
% }
% "left"/"right" are 0-based indices into the "nodes" array. Node 0 is
% always the root. Leaf nodes carry "leaf":true and a "class" index
% matching the position in "classNames".

    numNodes = numel(tree.CutPredictor);
    nodes = cell(1, numNodes);

    % MATLAB tree nodes are 1-indexed; JSON output is 0-indexed to match
    % typical array conventions on the firmware side.
    for i = 1:numNodes
        predictorName = tree.CutPredictor{i};
        if isempty(predictorName)
            leafClass = string(tree.NodeClass(i));
            classIdx = find(classOrder == leafClass, 1) - 1;
            nodes{i} = struct('leaf', true, 'class', classIdx);
        else
            children = tree.Children(i, :);
            nodes{i} = struct( ...
                'feature', char(predictorName), ...
                'threshold', tree.CutPoint(i), ...
                'left', children(1) - 1, ...
                'right', children(2) - 1, ...
                'leaf', false);
        end
    end

    modelStruct = struct();
    modelStruct.classNames = cellstr(classOrder);
    modelStruct.nodes = nodes;
    % store root explicitly in case node ordering ever changes
    modelStruct.root = 0;

    jsonText = jsonencode(modelStruct);

    fid = fopen(outFile, 'w');
    assert(fid > 0, "Could not open %s for writing.", outFile);
    fprintf(fid, "%s", jsonText);
    fclose(fid);

    fprintf("Wrote %s (%d nodes, %d bytes).\n", outFile, numNodes, numel(jsonText));
end
