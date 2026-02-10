import React, { useState } from 'react';
import { X } from 'lucide-react';

interface NextStepsCardProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  dismissKey: string;
  variant?: 'info' | 'success';
  icon?: React.ReactNode;
}

const NextStepsCard: React.FC<NextStepsCardProps> = ({
  title, message, actionLabel, onAction, dismissKey, variant = 'info', icon
}) => {
  const [dismissed, setDismissed] = useState(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem(`dismissed_${dismissKey}`) === '1'
  );

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(`dismissed_${dismissKey}`, '1');
  };

  if (dismissed) return null;

  const isSuccess = variant === 'success';
  const bgClass = isSuccess ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50' : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50';
  const iconBgClass = isSuccess ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
  const btnClass = isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div className={`mb-4 p-4 rounded-xl border ${bgClass} relative`}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-8">
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBgClass}`}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
          <p className="text-sm text-muted-foreground mb-3">{message}</p>
          <button
            onClick={onAction}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${btnClass}`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NextStepsCard;
