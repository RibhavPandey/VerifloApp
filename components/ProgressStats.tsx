import React from 'react';

interface ProgressStatsProps {
  invoicesProcessed: number;
  accuracyRate: number;
}

const ProgressStats: React.FC<ProgressStatsProps> = ({ invoicesProcessed, accuracyRate }) => {
  return (
    <div className="mb-6 p-4 bg-card rounded-xl border border-border flex flex-wrap gap-6">
      <div>
        <div className="text-2xl font-bold text-foreground">{invoicesProcessed}</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Invoices processed</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{accuracyRate}%</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Accuracy rate</div>
      </div>
    </div>
  );
};

export default ProgressStats;
