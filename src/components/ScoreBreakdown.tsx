import type { ScoreBreakdown as ScoreBreakdownType } from '@/lib/types';

interface ScoreBreakdownProps {
    breakdown: ScoreBreakdownType;
    total: number;
}

const FACTORS = [
    { key: 'profit' as const, label: 'Profit', max: 40, color: 'bg-purple-500', desc: 'Log-scaled total profit' },
    { key: 'winRate' as const, label: 'Win Rate', max: 25, color: 'bg-blue-500', desc: 'Adj. for sample size' },
    { key: 'volume' as const, label: 'Volume', max: 15, color: 'bg-cyan-500', desc: 'Market count sweet spot' },
    { key: 'recency' as const, label: 'Recency', max: 10, color: 'bg-amber-500', desc: 'Days since last trade' },
    { key: 'conviction' as const, label: 'Conviction', max: 10, color: 'bg-rose-500', desc: 'Position size vs avg' },
];

export function ScoreBreakdown({ breakdown, total }: ScoreBreakdownProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">Score Breakdown</span>
                <span className="text-sm text-gray-500">Total: <span className="text-white font-bold">{total.toFixed(1)}</span>/100</span>
            </div>
            {FACTORS.map((factor) => {
                const value = breakdown[factor.key];
                const pct = (value / factor.max) * 100;
                return (
                    <div key={factor.key} className="group">
                        <div className="flex items-center justify-between text-xs mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400">{factor.label}</span>
                                <span className="text-gray-600 hidden group-hover:inline">{factor.desc}</span>
                            </div>
                            <span className="text-gray-300 font-mono">
                                {value.toFixed(1)}/{factor.max}
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${factor.color} transition-all duration-300`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
