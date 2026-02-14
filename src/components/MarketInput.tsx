'use client';

import { useState } from 'react';

interface MarketInputProps {
    onAnalyze: (url: string) => void;
    loading: boolean;
}

export function MarketInput({ onAnalyze, loading }: MarketInputProps) {
    const [url, setUrl] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim() && !loading) {
            onAnalyze(url.trim());
        }
    };

    const exampleMarkets = [
        { label: 'President 2028', url: 'https://polymarket.com/event/presidential-election-winner-2028' },
        { label: 'NBA Champion', url: 'https://polymarket.com/event/2026-nba-champion' },
    ];

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
            <form onSubmit={handleSubmit}>
                <label
                    htmlFor="market-url"
                    className="block text-sm font-medium text-gray-400 mb-2"
                >
                    Polymarket Event URL
                </label>
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <input
                            id="market-url"
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://polymarket.com/event/..."
                            disabled={loading}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                       placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50
                       focus:ring-1 focus:ring-purple-500/25 transition-all disabled:opacity-50"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="px-6 py-3 rounded-xl font-medium transition-all
                     bg-gradient-to-r from-purple-600 to-blue-600
                     hover:from-purple-500 hover:to-blue-500
                     disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500
                     shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30
                     disabled:shadow-none"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                Analyzing
                            </span>
                        ) : (
                            'Analyze'
                        )}
                    </button>
                </div>
            </form>

            {/* Quick examples */}
            <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-gray-600">Try:</span>
                {exampleMarkets.map((ex) => (
                    <button
                        key={ex.label}
                        onClick={() => setUrl(ex.url)}
                        disabled={loading}
                        className="px-3 py-1 rounded-lg bg-white/5 text-gray-400 hover:text-white
                     hover:bg-white/10 transition-all text-xs border border-white/5
                     disabled:opacity-50"
                    >
                        {ex.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
