import React, { useState, useRef } from 'react';
import { SensorDataPoint, SENSOR_KEYS, SENSOR_COLORS, SensorKey } from '../types';

interface SensorChartProps {
  data: SensorDataPoint[];
  maxTimeSec?: number;
  height?: number;
  interactive?: boolean;
}

export const SensorChart: React.FC<SensorChartProps> = ({
  data,
  maxTimeSec = 15,
  height = 280,
  interactive = true,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const padding = { top: 20, right: 30, bottom: 35, left: 52 };
  const width = 800; // SVG internal coordinate width
  const svgHeight = height;

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  // Max time for domain: either maxTimeSec or current max elapsed in data
  const maxElapsedSec = data.length > 0 ? data[data.length - 1].time_ms / 1000 : 0;
  const timeDomainMax = Math.max(maxTimeSec, Math.ceil(maxElapsedSec));

  const xScale = (time_ms: number) => {
    const sec = time_ms / 1000;
    return padding.left + (sec / timeDomainMax) * innerWidth;
  };

  const yScale = (adc: number) => {
    // 0 to 4095 ADC counts
    const clamped = Math.max(0, Math.min(4095, adc));
    return padding.top + innerHeight - (clamped / 4095) * innerHeight;
  };

  // Generate SVG path for a given sensor
  const getSensorPath = (sensor: SensorKey) => {
    if (data.length === 0) return '';
    return data.reduce((acc, pt, idx) => {
      const x = xScale(pt.time_ms);
      const y = yScale(pt[sensor]);
      return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  };

  // Handle mouse move over chart for interactive tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    if (mouseX < padding.left || mouseX > width - padding.right) {
      setHoverIndex(null);
      return;
    }

    const mouseSec = ((mouseX - padding.left) / innerWidth) * timeDomainMax;
    const mouseMs = mouseSec * 1000;

    // Find closest data point
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < data.length; i++) {
      const diff = Math.abs(data[i].time_ms - mouseMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    setHoverIndex(closestIdx);
  };

  const activePoint = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;

  // Y-axis grid ticks (0, 1000, 2000, 3000, 4000)
  const yTicks = [0, 1000, 2000, 3000, 4000];

  // X-axis ticks (e.g. 0s, 3s, 6s, 9s, 12s, 15s)
  const xTicksCount = 5;
  const xTicks = Array.from({ length: xTicksCount + 1 }, (_, i) =>
    Math.round((i * timeDomainMax) / xTicksCount)
  );

  return (
    <div className="w-full flex flex-col" ref={containerRef}>
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {SENSOR_KEYS.map((s) => (
            <div key={s} className="flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-300">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shadow-xs"
                style={{ backgroundColor: SENSOR_COLORS[s] }}
              />
              <span className="font-semibold text-slate-700 dark:text-slate-200">{s}</span>
              {activePoint && (
                <span className="text-slate-900 dark:text-slate-100 font-bold ml-0.5">
                  {activePoint[s]}
                </span>
              )}
            </div>
          ))}
        </div>
        {activePoint && (
          <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            t = {(activePoint.time_ms / 1000).toFixed(1)}s | T: {activePoint.temp_c}°C | RH: {activePoint.rh_pct}%
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full bg-slate-50/70 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${svgHeight}`}
          className="w-full h-auto select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Background grid */}
          {yTicks.map((tick) => {
            const y = yScale(tick);
            return (
              <g key={`y-${tick}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="monospace"
                  className="fill-slate-400 dark:fill-slate-500"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* X Grid & Labels */}
          {xTicks.map((sec) => {
            const x = padding.left + (sec / timeDomainMax) * innerWidth;
            return (
              <g key={`x-${sec}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={svgHeight - padding.bottom}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={svgHeight - padding.bottom + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="monospace"
                  className="fill-slate-400 dark:fill-slate-500"
                >
                  {sec}s
                </text>
              </g>
            );
          })}

          {/* Axes lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={svgHeight - padding.bottom}
            stroke="currentColor"
            className="text-slate-300 dark:text-slate-700"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left}
            y1={svgHeight - padding.bottom}
            x2={width - padding.right}
            y2={svgHeight - padding.bottom}
            stroke="currentColor"
            className="text-slate-300 dark:text-slate-700"
            strokeWidth="1.5"
          />

          {/* Y-axis Title */}
          <text
            x={14}
            y={padding.top + innerHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90, 14, ${padding.top + innerHeight / 2})`}
            fontSize="10"
            className="fill-slate-500 dark:fill-slate-400 font-sans font-semibold tracking-wider uppercase text-[9px]"
          >
            ADC Counts (0–4095)
          </text>

          {/* Sensor lines */}
          {SENSOR_KEYS.map((sensor) => {
            const pathData = getSensorPath(sensor);
            if (!pathData) return null;
            return (
              <path
                key={sensor}
                d={pathData}
                fill="none"
                stroke={SENSOR_COLORS[sensor]}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Active hover crosshair and points */}
          {activePoint && (
            <g>
              <line
                x1={xScale(activePoint.time_ms)}
                y1={padding.top}
                x2={xScale(activePoint.time_ms)}
                y2={svgHeight - padding.bottom}
                stroke="#64748b"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              {SENSOR_KEYS.map((s) => (
                <circle
                  key={s}
                  cx={xScale(activePoint.time_ms)}
                  cy={yScale(activePoint[s])}
                  r="4"
                  fill={SENSOR_COLORS[s]}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          )}
        </svg>

        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-medium">
            Awaiting test initiation · Press "Start Test" to stream real-time traces
          </div>
        )}
      </div>
    </div>
  );
};
