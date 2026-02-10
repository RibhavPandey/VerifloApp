import React from 'react';
import { TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

interface ProgressStatsProps {
    invoicesProcessed: number;
    accuracyRate?: number;
}

const ProgressStats: React.FC<ProgressStatsProps> = ({
    invoicesProcessed,
    accuracyRate = 95,
}) => {
    // Calculate time saved (10 minutes per invoice)
    const timeSavedMinutes = invoicesProcessed * 10;
    const timeSavedHours = timeSavedMinutes / 60;

    const timeDisplay = timeSavedHours >= 1
        ? `${timeSavedHours.toFixed(1)}h`
        : `${timeSavedMinutes}m`;

    if (invoicesProcessed === 0) return null;

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
                Your Impact This Week
            </h3>

            <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <TrendingUp size={18} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {invoicesProcessed}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Invoices
                    </div>
                </div>

                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Clock size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {timeDisplay}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Time Saved
                    </div>
                </div>

                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {accuracyRate}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Accuracy
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgressStats;
