
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, X, Maximize2 } from 'lucide-react';
import { ChartDataPoint } from '../types';
import { createPortal } from 'react-dom';

interface ChartRendererProps {
  type: 'bar' | 'line' | 'pie' | 'area';
  data: any[];
  title: string;
  isThumbnail?: boolean;
  onExpand?: () => void;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// --- MATH & FORMATTING HELPERS ---

// Calculates a "nice" step size (1, 2, 5, 10...)
function niceNum(range: number, round: boolean) {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction;

  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

// Generates nice ticks for axes
function calculateNiceScale(min: number, max: number, tickCount: number = 5) {
  if (min === max) return { min: 0, max: max * 1.2 || 10, ticks: [0, max * 1.2] };

  const range = niceNum(max - min, false);
  const step = niceNum(range / (tickCount - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];

  const safeStep = step || 1;

  for (let t = niceMin; t <= niceMax + (safeStep * 0.1); t += safeStep) {
    ticks.push(t);
  }
  return { min: niceMin, max: niceMax, ticks };
}

// Formats numbers consistently based on the magnitude of the MAX value
const formatAxisValue = (num: number, maxVal: number) => {
  if (num === 0) return "0";
  const absMax = Math.abs(maxVal);

  if (absMax >= 1000000) {
    const val = num / 1000000;
    // e.g. 1.0M -> 1M, 1.25M -> 1.25M
    return parseFloat(val.toFixed(2)) + "M";
  }
  if (absMax >= 1000) {
    const val = num / 1000;
    return parseFloat(val.toFixed(1)) + "k";
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

// Formats numbers for tooltips
const formatTooltipValue = (num: number) => {
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const processData = (rawData: any[]): ChartDataPoint[] => {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];

  // Check for explicit format ({name, value} or {label, value})
  const sample = rawData[0];
  const hasStandardKeys = ('name' in sample || 'label' in sample) && 'value' in sample;

  if (hasStandardKeys) {
    return rawData.map(d => ({
      name: String(d.name || d.label || 'Unknown'),
      value: typeof d.value === 'number'
        ? d.value
        : parseFloat(String(d.value).replace(/,/g, '')) || 0
    })).filter(d => !isNaN(d.value));
  }

  // Auto-detect keys if missing (AI might return arbitrary keys)
  const keys = Object.keys(sample);
  // Find first string-ish key for Label
  const labelKey = keys.find(k => typeof sample[k] === 'string') || keys[0];
  // Find first number-ish key for Value, avoiding the label key
  const valueKey = keys.find(k => typeof sample[k] === 'number' && k !== labelKey) ||
    keys.find(k => !isNaN(parseFloat(String(sample[k]).replace(/,/g, ''))) && k !== labelKey);

  if (!valueKey) return []; // Can't graph without numbers

  return rawData.map(d => ({
    name: String(d[labelKey]),
    value: typeof d[valueKey] === 'number'
      ? d[valueKey]
      : parseFloat(String(d[valueKey]).replace(/,/g, '')) || 0
  })).filter(d => !isNaN(d.value));
};

export const ChartRenderer: React.FC<ChartRendererProps> = ({ type, data, title, isThumbnail = false, onExpand }) => {
  const [showModal, setShowModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 200 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        // Prevent 0 width/height collapse which causes white charts
        const w = Math.max(entries[0].contentRect.width, 300);
        const h = Math.max(entries[0].contentRect.height, 200);
        setDimensions({ width: Math.floor(w), height: Math.floor(h) });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const processedData = useMemo(() => processData(data), [data]);

  const handleExpand = () => {
    if (onExpand) onExpand();
    else setShowModal(true);
  };

  const chartContent = (
    <ChartEngine
      type={type}
      data={processedData}
      width={dimensions.width}
      height={dimensions.height}
      isThumbnail={isThumbnail}
    />
  );

  return (
    <>
      <div
        ref={containerRef}
        className={`w-full h-full relative group min-h-[200px] overflow-hidden ${isThumbnail ? 'cursor-pointer' : ''}`}
        onClick={isThumbnail ? handleExpand : undefined}
      >
        {chartContent}
        {isThumbnail && processedData.length > 0 && (
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
            <div className="bg-white/90 p-2 rounded-full shadow-sm text-blue-600">
              <Maximize2 size={20} />
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ChartModal
          type={type}
          data={processedData}
          title={title}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};

// --- CHART ENGINE ---
const ChartEngine: React.FC<{
  type: 'bar' | 'line' | 'pie' | 'area';
  data: ChartDataPoint[];
  width: number;
  height: number;
  isThumbnail: boolean;
}> = ({ type, data, width, height, isThumbnail }) => {

  // Empty State Logic
  if (!data || data.length === 0 || data.every(d => d.value === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-gray-50/50 rounded-lg text-gray-400 p-4 text-center">
        <span className="text-xs font-medium">No data available for visualization</span>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 0);
  const { min: scaleMin, max: scaleMax, ticks } = calculateNiceScale(0, maxValue, isThumbnail ? 3 : 5);

  // --- BAR CHART LOGIC ---
  if (type === 'bar') {
    // Decision: Use Horizontal Bars ONLY if there are many items OR labels are very long.
    const maxLabelLen = Math.max(...data.map(d => d.name.length));

    // Switch to horizontal if > 8 items OR very long names (>10 chars) 
    // This prevents cluttered x-axis on vertical charts.
    const useHorizontal = !isThumbnail && (data.length > 8 || (data.length > 3 && maxLabelLen > 10));

    // Increase bottom margin for thumbnails if labels are shown to prevent overflow
    const thumbnailBottomMargin = (isThumbnail && data.length < 8) ? 20 : 10;
    // Increase left margin for thumbnail vertical charts slightly
    const thumbnailLeftMargin = isThumbnail ? 15 : 5;

    // Dynamic left margin based on max label length (approx 6px per char)
    const dynamicLeftMargin = Math.min(200, Math.max(60, maxLabelLen * 6.5));

    const MARGIN = isThumbnail
      ? { top: 10, right: 10, bottom: thumbnailBottomMargin, left: thumbnailLeftMargin }
      : useHorizontal
        ? { top: 30, right: 40, bottom: 30, left: dynamicLeftMargin }
        : { top: 30, right: 20, bottom: 40, left: 50 };

    const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
    const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

    // Prevent divide by zero if plot dimensions are somehow 0
    if (plotWidth === 0 || plotHeight === 0 || scaleMax === 0) return null;

    if (useHorizontal) {
      // --- HORIZONTAL BAR CHART (Better for Ranks/Long Lists) ---
      const barHeight = Math.min(40, plotHeight / data.length * 0.7);
      const gap = (plotHeight - (barHeight * data.length)) / (data.length + 1);

      return (
        <svg width={width} height={height}>
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {/* Vertical Grid Lines */}
            {ticks.map((t) => {
              const x = (t / scaleMax) * plotWidth;
              if (isNaN(x)) return null;
              return (
                <g key={t}>
                  <line x1={x} y1={0} x2={x} y2={plotHeight} stroke="#f3f4f6" strokeDasharray="4 4" shapeRendering="crispEdges" />
                  <text x={x} y={-10} textAnchor="middle" fontSize={10} fill="#9ca3af">{formatAxisValue(t, scaleMax)}</text>
                </g>
              );
            })}

            {/* Bars */}
            {data.map((d, i) => {
              const w = (d.value / scaleMax) * plotWidth;
              const y = (i * (barHeight + gap)) + gap;
              if (isNaN(w) || isNaN(y)) return null;

              return (
                <g key={i}>
                  <rect
                    x={0} y={y} width={w} height={barHeight}
                    fill="#3b82f6" rx={2}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <title>{d.name}: {formatTooltipValue(d.value)}</title>
                  </rect>
                  {/* Name Label (Left Axis) */}
                  <text
                    x={-10} y={y + barHeight / 2 + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill="#4b5563"
                    fontWeight="500"
                    className="select-none pointer-events-none"
                  >
                    {d.name.length > 30 ? d.name.substring(0, 27) + '...' : d.name}
                  </text>
                  {/* Value Label (Right of bar) */}
                  <text x={w + 6} y={y + barHeight / 2 + 4} fontSize={10} fill="#6b7280">
                    {formatAxisValue(d.value, scaleMax)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      );
    } else {
      // --- VERTICAL BAR CHART (Standard/Thumbnail) ---
      const barPadding = plotWidth * 0.2 / data.length;
      const barWidth = Math.max(2, (plotWidth / data.length) - barPadding);

      return (
        <svg width={width} height={height}>
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {/* Horizontal Grid Lines */}
            {!isThumbnail && ticks.map(t => {
              const y = plotHeight - ((t / scaleMax) * plotHeight);
              if (isNaN(y)) return null;
              return (
                <g key={t}>
                  <line x1={0} y1={y} x2={plotWidth} y2={y} stroke="#f3f4f6" strokeDasharray="4 4" shapeRendering="crispEdges" />
                  <text x={-10} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{formatAxisValue(t, scaleMax)}</text>
                </g>
              );
            })}

            {/* Bars */}
            {data.map((d, i) => {
              const h = (d.value / scaleMax) * plotHeight;
              const x = i * (plotWidth / data.length) + (barPadding / 2);
              const y = plotHeight - h;

              if (isNaN(h) || isNaN(x) || isNaN(y)) return null;

              return (
                <g key={i}>
                  <rect
                    x={x} y={y} width={barWidth} height={h}
                    fill="#3b82f6" rx={2}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <title>{d.name}: {formatTooltipValue(d.value)}</title>
                  </rect>

                  {/* X Axis Labels - Only show if not thumbnail OR few items in thumbnail */}
                  {(!isThumbnail || data.length < 8) && (
                    <text
                      x={x + barWidth / 2}
                      y={plotHeight + 12}
                      textAnchor="middle"
                      fontSize={isThumbnail ? 8 : 10}
                      fill="#4b5563"
                    >
                      {d.name.substring(0, isThumbnail ? 4 : 12) + (d.name.length > (isThumbnail ? 4 : 12) ? '..' : '')}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="#e5e7eb" strokeWidth={1} shapeRendering="crispEdges" />
          </g>
        </svg>
      );
    }
  }

  // --- LINE / AREA CHART LOGIC ---
  if (type === 'line' || type === 'area') {
    const MARGIN = isThumbnail
      ? { top: 10, right: 10, bottom: 20, left: 10 }
      : { top: 20, right: 30, bottom: 40, left: 50 };

    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;

    if (plotWidth <= 0 || plotHeight <= 0) return null;

    const xStep = plotWidth / (data.length - 1 || 1);

    // Generate points
    const points = data.map((d, i) => {
      const x = i * xStep;
      const y = plotHeight - ((d.value / scaleMax) * plotHeight);
      if (isNaN(x) || isNaN(y)) return `0,${plotHeight}`; // Safety fallback
      return `${x},${y}`;
    }).join(' ');

    const areaPath = `${points} ${plotWidth},${plotHeight} 0,${plotHeight}`;

    return (
      <svg width={width} height={height}>
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Horizontal Grid */}
          {!isThumbnail && ticks.map(t => {
            const y = plotHeight - ((t / scaleMax) * plotHeight);
            if (isNaN(y)) return null;
            return (
              <g key={t}>
                <line x1={0} y1={y} x2={plotWidth} y2={y} stroke="#f3f4f6" strokeDasharray="4 4" shapeRendering="crispEdges" />
                <text x={-10} y={y + 3} textAnchor="end" fontSize={10} fill="#9ca3af">{formatAxisValue(t, scaleMax)}</text>
              </g>
            )
          })}

          {/* Area Fill */}
          {type === 'area' && (
            <polygon points={areaPath} fill="rgba(59, 130, 246, 0.1)" stroke="none" />
          )}

          {/* Line */}
          <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {/* Dots */}
          {data.map((d, i) => {
            const x = i * xStep;
            const y = plotHeight - ((d.value / scaleMax) * plotHeight);
            if (isNaN(x) || isNaN(y)) return null;
            return (
              <g key={i} className="group/dot">
                <circle cx={x} cy={y} r={isThumbnail ? 2 : 4} fill="white" stroke="#3b82f6" strokeWidth={2} className="hover:scale-150 transition-transform">
                  <title>{d.name}: {formatTooltipValue(d.value)}</title>
                </circle>
                {/* Hover tooltip for dot */}
                {!isThumbnail && (
                  <text x={x} y={y - 10} textAnchor="middle" fontSize={10} fill="#1f2937" opacity="0" className="group-hover/dot:opacity-100 transition-opacity bg-white pointer-events-none font-bold">
                    {formatAxisValue(d.value, scaleMax)}
                  </text>
                )}
              </g>
            );
          })}

          {/* X Labels */}
          {!isThumbnail && data.map((d, i) => {
            // Simple logic to skip overlapping labels if too dense
            const skipRate = data.length > 15 ? 3 : data.length > 8 ? 2 : 1;
            if (i % skipRate !== 0) return null;

            const x = i * xStep;
            if (isNaN(x)) return null;
            return (
              <text key={i} x={x} y={plotHeight + 20} textAnchor="middle" fontSize={10} fill="#6b7280">
                {d.name}
              </text>
            );
          })}
        </g>
      </svg>
    )
  }

  // --- PIE CHART LOGIC ---
  if (type === 'pie') {
    const MARGIN = { top: 10, right: 10, bottom: 10, left: 10 };
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;

    const radius = Math.min(plotWidth, plotHeight) / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
    let startAngle = 0;

    return (
      <svg width={width} height={height}>
        <g transform={`translate(${centerX}, ${centerY})`}>
          {data.map((d, i) => {
            const sliceAngle = (d.value / total) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            const x1 = Math.cos(startAngle) * radius;
            const y1 = Math.sin(startAngle) * radius;
            const x2 = Math.cos(endAngle) * radius;
            const y2 = Math.sin(endAngle) * radius;

            const largeArc = sliceAngle > Math.PI ? 1 : 0;
            const pathData = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            const midAngle = startAngle + sliceAngle / 2;
            const labelR = radius * 0.7;
            const lx = Math.cos(midAngle) * labelR;
            const ly = Math.sin(midAngle) * labelR;

            startAngle = endAngle;

            return (
              <g key={i}>
                <path d={pathData} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={1}>
                  <title>{d.name}: {formatTooltipValue(d.value)} ({(d.value / total * 100).toFixed(1)}%)</title>
                </path>
                {!isThumbnail && sliceAngle > 0.2 && (
                  <text x={lx} y={ly} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}>
                    {((d.value / total) * 100).toFixed(0)}%
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    );
  }

  return <div className="flex items-center justify-center h-full text-gray-400 text-xs">Unsupported chart type</div>;
}

// --- MODAL COMPONENT ---
export const ChartModal: React.FC<{
  type: any;
  data: any[];
  title: string;
  onClose: () => void;
}> = ({ type, data, title, onClose }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const scale = 2;
    const rect = svg.getBoundingClientRect();
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;

    img.onload = () => {
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        const a = document.createElement("a");
        a.download = `${title.replace(/\s+/g, '_')}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const maxValue = data.length > 0 ? Math.max(...data.map(d => d.value)) : 0;

  // Render via Portal to break out of any z-index or overflow constraints
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-500">Detailed Analysis View</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              <Download size={16} /> Export PNG
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div ref={chartRef} className="flex-1 p-8 bg-white overflow-hidden relative">
          <ChartRenderer type={type} data={data} title={title} isThumbnail={false} />
        </div>

        {/* Footer Stats */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex gap-6 text-sm">
          <div>
            <span className="text-gray-500 mr-2">Data Points:</span>
            <span className="font-bold text-gray-700">{data.length}</span>
          </div>
          <div>
            <span className="text-gray-500 mr-2">Max Value:</span>
            <span className="font-bold text-gray-700">{formatAxisValue(maxValue, maxValue)}</span>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
