/**
 * Trading Signal Generation
 *
 * Takes the top scored holders and produces an actionable signal:
 *   BUY YES  — strong consensus toward YES
 *   BUY NO   — strong consensus toward NO
 *   INCONCLUSIVE — mixed or insufficient data
 *
 * Also detects whale dominance (single holder > 40% of total analyzed value)
 * and adjusts confidence accordingly.
 */

import type { ScoredHolder, TradingSignal, HolderSummary } from './types';

export function generateTradingSignal(topHolders: ScoredHolder[]): TradingSignal {
    // ── Edge case: insufficient data ──────────────────────────────────────────
    if (topHolders.length < 3) {
        return {
            signal: 'INCONCLUSIVE',
            confidence: 0,
            reasoning: `Only ${topHolders.length} holder(s) meet the criteria. Need at least 3 for a meaningful signal.`,
            data: null,
        };
    }

    // ── Split by position ─────────────────────────────────────────────────────
    const yesList = topHolders.filter((h) => h.currentPosition === 'YES');
    const noList = topHolders.filter((h) => h.currentPosition === 'NO');

    // ── Weight by position size × credibility score ───────────────────────────
    //    A $1000 position from an 80-score holder counts as $800 effective weight.
    //    This ensures high-quality traders have proportionally more influence.
    const weightedValue = (h: ScoredHolder) =>
        h.currentPositionSize * (h.credibilityScore.total / 100);

    const yesValue = yesList.reduce((sum, h) => sum + weightedValue(h), 0);
    const noValue = noList.reduce((sum, h) => sum + weightedValue(h), 0);
    const totalValue = yesValue + noValue;

    // Also track raw (unweighted) values for display
    const yesValueRaw = yesList.reduce((sum, h) => sum + h.currentPositionSize, 0);
    const noValueRaw = noList.reduce((sum, h) => sum + h.currentPositionSize, 0);

    // Avoid division by zero
    if (totalValue === 0) {
        return {
            signal: 'INCONCLUSIVE',
            confidence: 0,
            reasoning: 'Total position value is $0. Cannot generate signal.',
            data: null,
        };
    }

    const yesPercentage = yesValue / totalValue;

    // ── Whale detection ───────────────────────────────────────────────────────
    const whaleThreshold = totalValue * 0.4;
    const whale = topHolders.find((h) => weightedValue(h) > whaleThreshold);

    // ── Confidence calculation ────────────────────────────────────────────────
    //    Based on how lopsided the distribution is
    let confidence: number;
    const dominance = Math.max(yesPercentage, 1 - yesPercentage);

    if (dominance > 0.80) {
        confidence = 9;  // Very strong consensus
    } else if (dominance > 0.70) {
        confidence = 7;
    } else if (dominance > 0.60) {
        confidence = 5;
    } else {
        confidence = 3;  // Divided opinion
    }

    // Reduce confidence if whale detected
    if (whale) {
        confidence = Math.max(1, confidence - 3);
    }

    // Boost confidence slightly if many holders agree (count-based)
    const dominantCount = Math.max(yesList.length, noList.length);
    const countRatio = dominantCount / topHolders.length;
    if (countRatio >= 0.80 && topHolders.length >= 5) {
        confidence = Math.min(10, confidence + 1);
    }

    // ── Signal decision ───────────────────────────────────────────────────────
    let signal: TradingSignal['signal'];
    if (yesPercentage >= 0.65 && confidence >= 5) {
        signal = 'BUY YES';
    } else if (yesPercentage <= 0.35 && confidence >= 5) {
        signal = 'BUY NO';
    } else {
        signal = 'INCONCLUSIVE';
    }

    // ── Build reasoning string ────────────────────────────────────────────────
    let reasoning = '';

    reasoning += `${yesList.length} of ${topHolders.length} top holders `;
    reasoning += `(${Math.round(yesPercentage * 100)}% by credibility-weighted value) are in YES, `;
    reasoning += `with $${formatDollars(yesValueRaw)} in YES positions vs $${formatDollars(noValueRaw)} in NO positions. `;

    if (whale) {
        const whalePct = Math.round((weightedValue(whale) / totalValue) * 100);
        reasoning += `⚠️ Whale Alert: One holder controls ${whalePct}% of analyzed value — confidence reduced. `;
    }

    if (signal === 'INCONCLUSIVE') {
        if (dominance < 0.60) {
            reasoning += 'The market is split among smart money — no clear directional edge.';
        } else {
            reasoning += 'Leaning signal detected but confidence threshold not met.';
        }
    }

    // ── Build holder summaries ────────────────────────────────────────────────
    const holderSummaries: HolderSummary[] = topHolders.map((h) => ({
        address: shortenAddress(h.address),
        username: h.username,
        score: h.credibilityScore.total,
        scoreBreakdown: h.credibilityScore.breakdown,
        position: h.currentPosition,
        size: Math.round(h.currentPositionSize * 100) / 100,
        profit: Math.round(h.totalProfit * 100) / 100,
        winRate: Math.round(h.winRate * 10) / 10,
        totalMarkets: h.totalMarkets,
    }));

    return {
        signal,
        confidence,
        reasoning,
        data: {
            yesHolders: yesList.length,
            noHolders: noList.length,
            yesValue: Math.round(yesValueRaw * 100) / 100,
            noValue: Math.round(noValueRaw * 100) / 100,
            yesPercentage: Math.round(yesPercentage * 1000) / 1000,
            whaleDetected: !!whale,
            topHolders: holderSummaries,
        },
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function shortenAddress(addr: string): string {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDollars(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
}
