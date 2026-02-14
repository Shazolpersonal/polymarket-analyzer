import type { TradingSignal } from '@/lib/types';

interface SignalCardProps {
    signal: TradingSignal;
}

export function SignalCard({ signal }: SignalCardProps) {
    const config = getSignalConfig(signal.signal);

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-8 ${config.border} ${config.bg}`}
        >
            {/* Subtle glow effect */}
            <div
                className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20 ${config.glow}`}
            />

            <div className="relative z-10">
                {/* Signal + Confidence row */}
                <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">{config.emoji}</span>
                        <div>
                            <div className={`text-3xl font-bold ${config.text}`}>
                                {signal.signal}
                            </div>
                            <div className="text-gray-400 text-sm mt-1">Trading Signal</div>
                        </div>
                    </div>

                    {/* Confidence meter */}
                    <div className="text-right">
                        <div className="text-sm text-gray-400 mb-1">Confidence</div>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-0.5">
                                {Array.from({ length: 10 }, (_, i) => (
                                    <div
                                        key={i}
                                        className={`w-3 h-6 rounded-sm transition-all ${i < signal.confidence
                                                ? config.barFill
                                                : 'bg-white/10'
                                            }`}
                                    />
                                ))}
                            </div>
                            <span className={`text-xl font-bold ml-2 ${config.text}`}>
                                {signal.confidence}/10
                            </span>
                        </div>
                    </div>
                </div>

                {/* Reasoning */}
                <div className="bg-black/20 rounded-xl p-4">
                    <p className="text-gray-300 leading-relaxed">{signal.reasoning}</p>
                </div>

                {/* Summary stats */}
                {signal.data && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <StatBox
                            label="YES Holders"
                            value={signal.data.yesHolders.toString()}
                            color="text-emerald-400"
                        />
                        <StatBox
                            label="NO Holders"
                            value={signal.data.noHolders.toString()}
                            color="text-red-400"
                        />
                        <StatBox
                            label="YES Value"
                            value={`$${formatDollars(signal.data.yesValue)}`}
                            color="text-emerald-400"
                        />
                        <StatBox
                            label="NO Value"
                            value={`$${formatDollars(signal.data.noValue)}`}
                            color="text-red-400"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function StatBox({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
        </div>
    );
}

function getSignalConfig(signal: string) {
    switch (signal) {
        case 'BUY YES':
            return {
                bg: 'bg-emerald-500/[0.06]',
                border: 'border-emerald-500/30',
                text: 'text-emerald-400',
                glow: 'bg-emerald-500',
                emoji: '🟢',
                barFill: 'bg-emerald-500',
            };
        case 'BUY NO':
            return {
                bg: 'bg-red-500/[0.06]',
                border: 'border-red-500/30',
                text: 'text-red-400',
                glow: 'bg-red-500',
                emoji: '🔴',
                barFill: 'bg-red-500',
            };
        default:
            return {
                bg: 'bg-amber-500/[0.06]',
                border: 'border-amber-500/30',
                text: 'text-amber-400',
                glow: 'bg-amber-500',
                emoji: '🟡',
                barFill: 'bg-amber-500',
            };
    }
}

function formatDollars(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
}
