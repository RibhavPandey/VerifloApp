
import React from 'react';
import { ArrowRight, ArrowDown, ArrowUp, ShieldCheck, AlertTriangle, Sparkles } from 'lucide-react';
import { AnalysisResult, BucketItem, SanityData } from '../types';

export const SummaryCard = ({ metrics }: { metrics: AnalysisResult['metrics'] }) => (
  <div className="flex items-center justify-center gap-4 md:gap-8 mb-6 p-4 bg-white rounded-xl border border-gray-100 shadow-sm w-full">
      <div className="text-center min-w-0 flex-1">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">{metrics.oldLabel}</div>
          <div className="text-xl font-bold text-gray-500 truncate" title={metrics.oldValue}>{metrics.oldValue}</div>
      </div>
      <div className="flex flex-col items-center flex-shrink-0">
          <ArrowRight className="text-gray-300 mb-1" size={16} />
      </div>
      <div className="text-center min-w-0 flex-1">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">{metrics.newLabel}</div>
          <div className="text-2xl font-bold text-gray-800 truncate" title={metrics.newValue}>{metrics.newValue}</div>
      </div>
      <div className={`ml-2 md:ml-4 flex flex-col items-center justify-center px-3 py-1 rounded-lg text-sm font-bold flex-shrink-0 ${metrics.isNegative ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          <span className="flex items-center gap-1 whitespace-nowrap">{metrics.isNegative ? <ArrowDown size={14} /> : <ArrowUp size={14} />} {metrics.percent}</span>
          <span className="text-[10px] opacity-80 whitespace-nowrap">{metrics.delta}</span>
      </div>
  </div>
);

export const BucketCard = ({ buckets }: { buckets: BucketItem[] }) => (
  <div className="grid grid-cols-3 gap-3 mb-6">
      {buckets.map((b, i) => {
          const colors: Record<string, string> = {
              red: 'bg-red-50 border-red-100 text-red-700',
              yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
              green: 'bg-green-50 border-green-100 text-green-700'
          };
          return (
              <div key={i} className={`p-3 rounded-xl border ${colors[b.color] || colors.yellow} flex flex-col items-center text-center min-w-0`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1 truncate w-full">{b.label}</span>
                  <span className="text-lg font-bold mb-1 truncate w-full" title={b.impact}>{b.impact}</span>
                  <span className="text-xs font-medium opacity-80 whitespace-nowrap">{b.count} rows</span>
              </div>
          )
      })}
  </div>
);

export const ContributionCard = ({ drivers }: { drivers: AnalysisResult['drivers'] }) => (
  <div className="mb-6 w-full">
      <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Top Drivers of Change</h4>
      </div>
      <div className="space-y-2">
          {drivers.slice(0, 5).map((d, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-100 rounded-lg hover:bg-white transition-colors w-full">
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                      <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center bg-white border border-gray-200 rounded-full text-[10px] font-bold text-gray-500">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-700 truncate block" title={d.name}>{d.name}</span>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${d.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {d.value}
                  </span>
              </div>
          ))}
          {drivers.length > 5 && (
              <div className="text-center pt-2">
                  <button className="text-xs font-bold text-blue-600 hover:text-blue-700">View All {drivers.length} Drivers</button>
              </div>
          )}
      </div>
  </div>
);

export const SanityCard = ({ sanity }: { sanity: SanityData }) => {
   const scoreColor = sanity.score > 80 ? 'text-green-600' : sanity.score > 50 ? 'text-yellow-600' : 'text-red-600';
   return (
      <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 w-full">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                  <ShieldCheck className={scoreColor} size={20} />
                  <span className="font-bold text-gray-700">Trust Score</span>
              </div>
              <div className="flex items-center gap-3">
                  <span className={`text-2xl font-black ${scoreColor}`}>{sanity.score}</span>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${sanity.riskLevel === 'Low' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {sanity.riskLevel} Risk
                  </span>
              </div>
          </div>
          
          <ul className="space-y-2 mb-4">
              {sanity.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600 break-words">
                      <AlertTriangle size={12} className="text-orange-500 mt-0.5 shrink-0" />
                      <span className="break-words">{w}</span>
                  </li>
              ))}
          </ul>

          {sanity.suggestion && (
              <div className="bg-blue-50 text-blue-700 p-2 rounded-lg text-xs font-medium flex gap-2">
                  <Sparkles size={12} className="mt-0.5 shrink-0" />
                  <span className="break-words">{sanity.suggestion}</span>
              </div>
          )}
      </div>
   )
};

export const AnalysisContent: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    return (
        <div className="w-full">
            {/* PRIMARY CARD RENDERING LOGIC */}
            {result.intent === 'SUMMARY' && <SummaryCard metrics={result.metrics} />}
            {result.intent === 'CHANGE_EXPLANATION' && (
                <>
                    <SummaryCard metrics={result.metrics} />
                    {result.buckets && <BucketCard buckets={result.buckets} />}
                </>
            )}
            {result.intent === 'DIMENSION_ANALYSIS' && (
                <>
                    <SummaryCard metrics={result.metrics} />
                    {result.drivers && <ContributionCard drivers={result.drivers} />}
                </>
            )}
            {result.intent === 'SANITY_CHECK' && result.sanity && <SanityCard sanity={result.sanity} />}
        </div>
    );
};
