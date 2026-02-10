import React from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

export interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  action?: () => void;
}

interface OnboardingProgressProps {
  steps: OnboardingStep[];
  onStepClick?: (step: OnboardingStep) => void;
  onDismiss?: () => void;
}

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  steps,
  onStepClick,
  onDismiss,
}) => {
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;
  const isVisible = !allDone;

  if (!isVisible) return null;

  return (
    <div className="mb-8 p-4 md:p-5 bg-card rounded-xl border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
          Get Started
        </h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{steps.length} complete
        </span>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => step.action && onStepClick?.(step)}
            disabled={!step.action || step.done}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
              step.done
                ? 'text-muted-foreground'
                : step.action
                ? 'hover:bg-muted/50 text-foreground'
                : 'text-muted-foreground cursor-default'
            }`}
          >
            {step.done ? (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <Circle size={18} className="text-muted-foreground/50 flex-shrink-0" />
            )}
            <span className="text-sm font-medium flex-1">{step.label}</span>
            {!step.done && step.action && (
              <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default OnboardingProgress;
