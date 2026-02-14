'use client';

import { useState } from 'react';
import { MarketInput } from '@/components/MarketInput';
import { SignalCard } from '@/components/SignalCard';
import { HolderTable } from '@/components/HolderTable';
import { MarketHeader } from '@/components/MarketHeader';
import type { AnalysisResult } from '@/lib/types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (url: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error (${response.status})`);
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background gradient effects */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Smart Money Analysis Engine
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Polymarket Analyzer
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Identify profitable traders (&ldquo;smart money&rdquo;) and follow their positions.
            Paste any Polymarket URL to get an actionable trading signal.
          </p>
        </header>

        {/* Input Section */}
        <MarketInput onAnalyze={handleAnalyze} loading={loading} />

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-xl">⚠️</span>
              <div>
                <p className="font-medium text-red-300">Analysis Error</p>
                <p className="text-red-400/80 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mt-10 text-center">
            <div className="inline-flex flex-col items-center gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 animate-spin" />
              </div>
              <div>
                <p className="text-gray-300 font-medium">Analyzing market...</p>
                <p className="text-gray-500 text-sm mt-1">
                  Fetching holders, computing credibility scores, generating signal
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="mt-10 space-y-6">
            <MarketHeader market={result.market} />
            <SignalCard signal={result.signal} />
            {result.signal.data && (
              <HolderTable
                holders={result.signal.data.topHolders}
                yesHolders={result.signal.data.yesHolders}
                noHolders={result.signal.data.noHolders}
                yesValue={result.signal.data.yesValue}
                noValue={result.signal.data.noValue}
              />
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-20 text-center text-gray-600 text-sm">
          <p>
            Smart money analysis based on Polymarket on-chain data.
            Not financial advice.
          </p>
        </footer>
      </div>
    </div>
  );
}
