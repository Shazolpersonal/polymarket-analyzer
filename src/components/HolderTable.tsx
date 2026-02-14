'use client';

import React, { useState } from 'react';
import type { HolderSummary } from '@/lib/types';
import { ScoreBreakdown } from './ScoreBreakdown';

interface HolderTableProps {
    holders: HolderSummary[];
    yesHolders: number;
    noHolders: number;
    yesValue: number;
    noValue: number;
}

export function HolderTable({ holders, yesHolders, noHolders, yesValue, noValue }: HolderTableProps) {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const totalValue = yesValue + noValue;
    const yesPercent = totalValue > 0 ? Math.round((yesValue / totalValue) * 100) : 50;

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-white">Top Holders Breakdown</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {holders.length} holders analyzed • Sorted by credibility score
                        </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="text-gray-400">
                                {yesHolders} YES ({yesPercent}%)
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-gray-400">
                                {noHolders} NO ({100 - yesPercent}%)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Distribution bar */}
                <div className="mt-4 flex rounded-full overflow-hidden h-2 bg-white/5">
                    <div
                        className="bg-emerald-500 transition-all duration-500"
                        style={{ width: `${yesPercent}%` }}
                    />
                    <div
                        className="bg-red-500 transition-all duration-500"
                        style={{ width: `${100 - yesPercent}%` }}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-white/5">
                            <th className="px-6 py-3 text-left">#</th>
                            <th className="px-6 py-3 text-left">Wallet</th>
                            <th className="px-6 py-3 text-right">Score</th>
                            <th className="px-6 py-3 text-center">Position</th>
                            <th className="px-6 py-3 text-right">Size</th>
                            <th className="px-6 py-3 text-right">Total P&L</th>
                            <th className="px-6 py-3 text-right">Win Rate</th>
                            <th className="px-6 py-3 text-right">Markets</th>
                        </tr>
                    </thead>
                    <tbody>
                        {holders.map((holder, i) => (
                            <React.Fragment key={`holder-${i}`}>
                                <tr
                                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                                    className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer
                           transition-colors group"
                                >
                                    <td className="px-6 py-4 text-gray-500 text-sm">{i + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm text-gray-300">
                                                {holder.address}
                                            </span>
                                            {holder.username && (
                                                <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                                                    @{holder.username}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-white">{holder.score.toFixed(1)}</span>
                                        <span className="text-gray-600 text-sm">/100</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span
                                            className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${holder.position === 'YES'
                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                                                }`}
                                        >
                                            {holder.position}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-300">
                                        ${holder.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td
                                        className={`px-6 py-4 text-right font-medium ${holder.profit > 0 ? 'text-emerald-400' : 'text-red-400'
                                            }`}
                                    >
                                        {holder.profit > 0 ? '+' : ''}
                                        ${holder.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-300">
                                        {holder.winRate.toFixed(1)}%
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-400">
                                        {holder.totalMarkets}
                                    </td>
                                </tr>
                                {/* Expanded score breakdown */}
                                {expandedRow === i && (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-4 bg-white/[0.02]">
                                            <ScoreBreakdown breakdown={holder.scoreBreakdown} total={holder.score} />
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
