import React from 'react';
import { X, ArrowRight } from 'lucide-react';

interface NextStepsCardProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  dismissKey: string;
  variant?: 'info' | 'success' | 'warning';
  icon?: React.ReactNode;
}

const NextStepsCard: React.FC<NextStepsCardProps> = ({
  title,
  message,
  actionLabel,
  onAction,
  dismissKey,
  variant = 'info',
  icon,
}) => {
  const [isDismissed, setIsDismissed] = React.useState(false);

  React.useEffect(() => {
    const dismissed = localStorage.getItem(`dismissed_${dismissKey}`);
    if (dismissed) {
      setIsDismissed(true);
    }
  }, [dismissKey]);

  const handleDismiss = () => {
    localStorage.setItem(`dismissed_${dismissKey}`, 'true');
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  const variantStyles = {
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50',
    success: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50',
    warning: 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/50',
  };

  const iconColors = {
    info: 'text-blue-600 dark:text-blue-400',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-orange-600 dark:text-orange-400',
  };

  const buttonColors = {
    info: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    success: 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
    warning: 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600',
  };

  return (
    <div className={`relative border rounded-xl p-4 mb-6 ${variantStyles[variant]}`}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} className="text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        {icon && (
          <div className={`flex-shrink-0 ${iconColors[variant]}`}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {message}
          </p>
          <button
            onClick={onAction}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${buttonColors[variant]}`}
          >
            {actionLabel}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NextStepsCard;
