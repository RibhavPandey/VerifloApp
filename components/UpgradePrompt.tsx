import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
  currentUsage: number;
  limit: number;
  mode: 'banner' | 'modal';
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ currentUsage, limit, mode }) => {
  const navigate = useNavigate();
  const [modalDismissed, setModalDismissed] = useState(false);

  const isAtLimit = currentUsage >= limit;
  const message = isAtLimit
    ? `You've used all ${limit} documents this period. Upgrade for more.`
    : `You've used ${currentUsage} of ${limit} documents. Upgrade for 150/month.`;

  if (mode === 'banner') {
    return (
      <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center justify-between gap-4">
        <p className="text-sm text-amber-900 dark:text-amber-100">{message}</p>
        <button
          onClick={() => navigate('/pricing')}
          className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-amber-900 dark:text-amber-100 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-900/70 rounded-lg transition-colors"
        >
          View Pricing
        </button>
      </div>
    );
  }

  if (mode === 'modal' && !modalDismissed) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setModalDismissed(true)}>
        <div className="bg-background p-6 rounded-2xl shadow-xl max-w-sm w-full border border-border" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-foreground mb-2">Document limit reached</h3>
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/pricing')}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-foreground rounded-xl hover:bg-foreground/90"
            >
              Upgrade
            </button>
            <button
              onClick={() => setModalDismissed(true)}
              className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-xl"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default UpgradePrompt;
