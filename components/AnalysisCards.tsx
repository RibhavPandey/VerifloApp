
import React from 'react';
import { ArrowRight, ArrowDown, ArrowUp, ShieldCheck, AlertTriangle, Sparkles } from 'lucide-react';
import { AnalysisResult, BucketItem, SanityData } from '../types';

const isMetricSane = (percent: string): boolean => {
  const p = String(percent || '').toLowerCase();
  return !p.includes('infinite') && !p.includes('from 0');
};

export const SummaryCard = ({ metrics }: { metrics: AnalysisResult['metrics'] }) => {
  const showDelta = isMetricSane(metrics.percent ?? '');
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-card border border-border w-full">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground truncate">{metrics.oldLabel}</div>
          <div className="text-lg font-semibold text-foreground truncate" title={metrics.oldValue}>{metrics.oldValue}</div>
        </div>
        <ArrowRight className="flex-shrink-0 text-muted-foreground/60" size={16} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground truncate">{metrics.newLabel}</div>
          <div className="text-lg font-semibold text-foreground truncate" title={metrics.newValue}>{metrics.newValue}</div>
        </div>
      </div>
      {showDelta && (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0 ${metrics.isNegative ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
          {metrics.isNegative ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
          <span>{metrics.percent}</span>
          <span className="text-xs opacity-80">{metrics.delta}</span>
        </div>
      )}
    </div>
  );
};

export const BucketCard = ({ buckets }: { buckets: BucketItem[] }) => {
  const colorMap: Record<string, string> = {
    red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
    yellow: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
      {buckets.map((b, i) => (
        <div key={i} className={`p-3 rounded-xl border ${colorMap[b.color] || colorMap.yellow} flex flex-col items-center text-center min-w-0`}>
          <span className="text-xs font-medium opacity-80 truncate w-full">{b.label}</span>
          <span className="text-base font-semibold mt-0.5 truncate w-full" title={b.impact}>{b.impact}</span>
          <span className="text-xs text-muted-foreground mt-1">{b.count} rows</span>
        </div>
      ))}
    </div>
  );
};

export const ContributionCard = ({ drivers }: { drivers: AnalysisResult['drivers'] }) => (
  <div className="w-full">
    <h4 className="text-xs font-medium text-muted-foreground mb-2">Top drivers</h4>
    <div className="space-y-1.5">
      {drivers.slice(0, 5).map((d, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-muted/50 border border-border">
          <span className="text-xs font-medium text-muted-foreground w-5 flex-shrink-0">{i + 1}</span>
          <span className="text-sm font-medium text-foreground truncate min-w-0 flex-1" title={d.name}>{d.name}</span>
          <span className={`text-sm font-semibold flex-shrink-0 ${d.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {d.value}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export const SanityCard = ({ sanity }: { sanity: SanityData }) => {
  const scoreColor = sanity.score > 80 ? 'text-green-600 dark:text-green-400' : sanity.score > 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const riskClass = sanity.riskLevel === 'Low' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-700 dark:text-red-400';
  return (
    <div className="rounded-xl border border-border bg-card p-4 w-full">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck className={scoreColor} size={18} />
          <span className="text-sm font-semibold text-foreground">Trust score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xl font-bold ${scoreColor}`}>{sanity.score}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskClass}`}>
            {sanity.riskLevel} risk
          </span>
        </div>
      </div>
      {sanity.warnings.length > 0 && (
        <ul className="space-y-1.5 mt-3">
          {sanity.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
              <span className="break-words">{w}</span>
            </li>
          ))}
        </ul>
      )}
      {sanity.suggestion && (
        <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border flex gap-2">
          <Sparkles size={12} className="shrink-0 text-muted-foreground mt-0.5" />
          <span className="text-xs text-foreground">{sanity.suggestion}</span>
        </div>
      )}
    </div>
  );
};

export const AnalysisContent: React.FC<{ result: AnalysisResult }> = ({ result }) => (
  <div className="w-full space-y-4">
    {result.intent === 'SUMMARY' && <SummaryCard metrics={result.metrics} />}
    {result.intent === 'CHANGE_EXPLANATION' && (
      <>
        <SummaryCard metrics={result.metrics} />
        {result.buckets && result.buckets.length > 0 && <BucketCard buckets={result.buckets} />}
      </>
    )}
    {result.intent === 'DIMENSION_ANALYSIS' && (
      <>
        <SummaryCard metrics={result.metrics} />
        {result.drivers && result.drivers.length > 0 && <ContributionCard drivers={result.drivers} />}
      </>
    )}
    {result.intent === 'SANITY_CHECK' && result.sanity && <SanityCard sanity={result.sanity} />}
  </div>
);
