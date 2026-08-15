import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  RefreshCw,
  CheckCircle2,
  BookmarkPlus,
  AlertTriangle,
  Sparkles,
  Info,
} from 'lucide-react';
import { SampleType, OnionVerdict, MilkVerdict, Verdict, InspectionRecord, SAMPLE_OPTIONS } from '../types';
import { getVerdictSeverity } from '../utils/simulation';

interface ImageCheckViewProps {
  selectedSample: SampleType;
  onSaveRecord: (record: InspectionRecord) => void;
}

export const ImageCheckView: React.FC<ImageCheckViewProps> = ({
  selectedSample,
  onSaveRecord,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    verdict: Verdict;
    confidence: number;
    sampleType: SampleType;
  } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const sampleLabel = SAMPLE_OPTIONS.find((s) => s.id === selectedSample)?.fullLabel || selectedSample;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      setImageSrc(src);
      runImageAnalysis(src);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access denied or unavailable', err);
      setCameraError('Unable to access camera. Please select or drop an image file instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    stopCamera();
    setImageSrc(dataUrl);
    runImageAnalysis(dataUrl);
  };

  const runImageAnalysis = (src: string) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setIsSaved(false);

    // Simulate standard vision classifier inference duration (1.5 - 2s)
    setTimeout(() => {
      let verdict: Verdict;
      let confidence = 88.5 + Math.random() * 9.5;

      if (selectedSample === 'onion') {
        const verdicts: OnionVerdict[] = ['Fresh', 'Slightly Aged', 'Moderately Spoiled', 'Highly Spoiled'];
        const r = Math.random();
        if (r < 0.4) verdict = 'Fresh';
        else if (r < 0.7) verdict = 'Slightly Aged';
        else if (r < 0.9) verdict = 'Moderately Spoiled';
        else verdict = 'Highly Spoiled';
      } else {
        const verdicts: MilkVerdict[] = ['Fresh', 'Slightly Sour', 'Spoiled'];
        const r = Math.random();
        if (r < 0.5) verdict = 'Fresh';
        else if (r < 0.8) verdict = 'Slightly Sour';
        else verdict = 'Spoiled';
      }

      setAnalysisResult({
        verdict,
        confidence: Number(confidence.toFixed(1)),
        sampleType: selectedSample,
      });
      setIsAnalyzing(false);
    }, 1600);
  };

  const handleSaveToHistory = () => {
    if (!analysisResult) return;
    const sampleOpt = SAMPLE_OPTIONS.find((s) => s.id === analysisResult.sampleType)!;
    const record: InspectionRecord = {
      id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      sampleType: analysisResult.sampleType,
      sampleLabel: sampleOpt.fullLabel,
      verdict: analysisResult.verdict,
      confidence: analysisResult.confidence,
      testType: 'image',
      imagePreviewUrl: imageSrc || undefined,
    };

    onSaveRecord(record);
    setIsSaved(true);
  };

  const handleReset = () => {
    stopCamera();
    setImageSrc(null);
    setAnalysisResult(null);
    setIsSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const severity = analysisResult ? getVerdictSeverity(analysisResult.verdict) : null;

  return (
    <div className="space-y-6">
      {/* Overview & Protocol Card */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Visual Sample Check
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Optical surface and consistency assessment for {sampleLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              Target: {sampleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Main Upload / Camera Area */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Camera Live View */}
        {cameraActive && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-w-xl mx-auto border border-slate-700">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                id="capture-photo-btn"
                type="button"
                onClick={capturePhoto}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Capture & Analyze</span>
              </button>
              <button
                id="cancel-camera-btn"
                type="button"
                onClick={stopCamera}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Upload Dropzone when no image and no camera */}
        {!imageSrc && !cameraActive && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const src = event.target?.result as string;
                    setImageSrc(src);
                    runImageAnalysis(src);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-colors group bg-slate-50/50 dark:bg-slate-950/40"
            >
              <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Upload a photo of {sampleLabel}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Drag and drop a clear photograph, or click to browse from device
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <span className="text-xs text-slate-400 font-mono">OR</span>
              <button
                id="open-camera-btn"
                type="button"
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Use Device Camera</span>
              </button>
            </div>

            {cameraError && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{cameraError}</span>
              </div>
            )}
          </div>
        )}

        {/* Selected / Captured Image Preview & Analysis State */}
        {imageSrc && (
          <div className="space-y-4">
            <div className="relative max-w-md mx-auto rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black/90">
              <img
                src={imageSrc}
                alt="Selected sample"
                referrerPolicy="no-referrer"
                className="w-full max-h-72 object-contain mx-auto"
              />
              <button
                id="reset-image-btn"
                type="button"
                onClick={handleReset}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-black/70 hover:bg-black text-white text-xs font-medium backdrop-blur-xs transition-colors"
              >
                Change Image
              </button>
            </div>

            {/* Analyzing Indicator */}
            {isAnalyzing && (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-2.5">
                <div className="inline-flex items-center justify-center p-2.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 animate-spin">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Analyzing visual features...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Evaluating surface texture, coloration, and morphological indicators
                </p>
              </div>
            )}

            {/* Analysis Result Card — STRICTLY NO SENSOR VALUES */}
            {analysisResult && severity && (
              <div
                className={`p-6 rounded-xl border ${severity.borderLight} ${severity.borderDark} ${severity.bgLight} ${severity.bgDark} shadow-xs space-y-4 animate-in fade-in duration-200`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: severity.color }}
                    >
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Visual Prediction · {sampleLabel}
                      </span>
                      <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {analysisResult.verdict}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="px-3.5 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-right shadow-xs">
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                        Confidence
                      </span>
                      <span className="text-base font-mono font-bold text-slate-900 dark:text-slate-100">
                        {analysisResult.confidence.toFixed(1)}%
                      </span>
                    </div>

                    <button
                      id="save-image-history-btn"
                      type="button"
                      disabled={isSaved}
                      onClick={handleSaveToHistory}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                        isSaved
                          ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800'
                          : 'bg-teal-600 hover:bg-teal-700 text-white'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>Save to History</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* EXACT MANDATED NOTE UNDER IT */}
                <div className="p-3 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <p className="font-medium leading-relaxed">
                    Image-based estimate — no sensor data used. For sensor-verified results, run a hardware test.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
