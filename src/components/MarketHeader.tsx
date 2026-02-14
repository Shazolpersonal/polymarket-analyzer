import type { MarketInfo } from '@/lib/types';

interface MarketHeaderProps {
    market: MarketInfo;
}

export function MarketHeader({ market }: MarketHeaderProps) {
    const yesPrice = market.outcomePrices[0] ?? 0.5;
    const noPrice = market.outcomePrices[1] ?? 0.5;

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        {market.active && !market.closed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Active
                            </span>
                        ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400 text-xs border border-gray-500/30">
                                Closed
                            </span>
                        )}
                        {market.endDate && (
                            <span className="text-xs text-gray-500">
                                Ends {new Date(market.endDate).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-white leading-tight">
                        {market.question}
                    </h2>
                </div>

                {/* Current prices */}
                <div className="flex gap-3">
                    <div className="text-center px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="text-xs text-gray-500 mb-0.5">YES</div>
                        <div className="text-xl font-bold text-emerald-400">
                            {(yesPrice * 100).toFixed(0)}¢
                        </div>
                    </div>
                    <div className="text-center px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div className="text-xs text-gray-500 mb-0.5">NO</div>
                        <div className="text-xl font-bold text-red-400">
                            {(noPrice * 100).toFixed(0)}¢
                        </div>
                    </div>
                </div>
            </div>

            {/* Market stats */}
            <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
                <span>
                    Volume:{' '}
                    <span className="text-gray-300">
                        ${market.volume >= 1_000_000
                            ? `${(market.volume / 1_000_000).toFixed(1)}M`
                            : market.volume >= 1_000
                                ? `${(market.volume / 1_000).toFixed(1)}K`
                                : market.volume.toFixed(0)}
                    </span>
                </span>
                <span>
                    Liquidity:{' '}
                    <span className="text-gray-300">
                        ${market.liquidity >= 1_000_000
                            ? `${(market.liquidity / 1_000_000).toFixed(1)}M`
                            : market.liquidity >= 1_000
                                ? `${(market.liquidity / 1_000).toFixed(1)}K`
                                : market.liquidity.toFixed(0)}
                    </span>
                </span>
            </div>
        </div>
    );
}
