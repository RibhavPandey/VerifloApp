import React, { useState, useEffect } from 'react';
import { X, Zap, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
    currentUsage: number;
    limit: number;
    mode: 'banner' | 'modal';
    onDismiss?: () => void;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({
    currentUsage,
    limit,
    mode,
    onDismiss,
}) => {
    const navigate = useNavigate();
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check if dismissed in last 24 hours
        const dismissedTime = localStorage.getItem('upgrade_prompt_dismissed');
        if (dismissedTime) {
            const hoursSinceDismiss = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
            if (hoursSinceDismiss < 24) {
                setIsDismissed(true);
            }
        }
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('upgrade_prompt_dismissed', Date.now().toString());
        setIsDismissed(true);
        onDismiss?.();
    };

    const handleUpgrade = () => {
        navigate('/pricing');
    };

    if (isDismissed) return null;

    // Banner mode (8-9/10 invoices)
    if (mode === 'banner') {
        return (
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 border border-orange-200 dark:border-orange-900/50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                            <Zap size={18} className="text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                                You've used {currentUsage}/{limit} free invoices this month
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Upgrade for unlimited processing
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleUpgrade}
                            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 rounded-lg transition-colors"
                        >
                            Upgrade
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                            aria-label="Dismiss"
                        >
                            <X size={16} className="text-muted-foreground" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Modal mode (10/10 invoices)
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-border">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-foreground mb-1">
                                You've reached your free limit
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Upgrade to continue processing invoices
                            </p>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                            aria-label="Close"
                        >
                            <X size={20} className="text-muted-foreground" />
                        </button>
                    </div>
                </div>

                {/* Pricing comparison */}
                <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                        {/* Free plan */}
                        <div className="border border-border rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                Free
                            </h3>
                            <div className="mb-4">
                                <span className="text-3xl font-bold text-foreground">$0</span>
                                <span className="text-muted-foreground">/month</span>
                            </div>
                            <ul className="space-y-2 mb-4">
                                <li className="flex items-start gap-2 text-sm">
                                    <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-muted-foreground">10 invoices/month</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-muted-foreground">Basic extraction</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-muted-foreground">CSV export</span>
                                </li>
                            </ul>
                        </div>

                        {/* Pro plan */}
                        <div className="border-2 border-primary rounded-xl p-5 relative bg-primary/5">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                                RECOMMENDED
                            </div>
                            <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
                                Pro
                            </h3>
                            <div className="mb-4">
                                <span className="text-3xl font-bold text-foreground">$49</span>
                                <span className="text-muted-foreground">/month</span>
                            </div>
                            <ul className="space-y-2 mb-6">
                                <li className="flex items-start gap-2 text-sm">
                                    <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-foreground font-medium">Unlimited invoices</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-foreground">Advanced extraction</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-foreground">Tally/QuickBooks export</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-foreground">Workflow automation</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                    <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-foreground">Priority support</span>
                                </li>
                            </ul>
                            <button
                                onClick={handleUpgrade}
                                className="w-full px-4 py-3 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                            >
                                Upgrade to Pro
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-center text-muted-foreground">
                        Cancel anytime. No questions asked.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UpgradePrompt;
