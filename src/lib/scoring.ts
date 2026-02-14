/**
 * Credibility Scoring Algorithm
 *
 * Five-factor score (0–100):
 *
 *   1. PROFIT MAGNITUDE  (40 pts) — Logarithmic scale. $5K ≈ 10pts, $500K+ ≈ 40pts.
 *      Rationale: proven track record is the strongest credibility signal,
 *      but gains at the top are diminishing (a $500K wallet is ~4x better than $5K, not 100x).
 *
 *   2. WIN RATE           (25 pts) — Adjusted for sample size (need 20+ markets for full weight).
 *      Rationale: 80% on 10 markets is less reliable than 60% on 100 markets.
 *
 *   3. TRADING VOLUME     (15 pts) — Sweet spot: 20–200 markets. Penalizes potential bots (500+).
 *      Rationale: too few markets = not enough data; too many = likely automated noise.
 *
 *   4. RECENCY            (10 pts) — Active traders get priority over dormant ones.
 *      Rationale: market conditions change; active traders have current context.
 *
 *   5. POSITION CONVICTION(10 pts) — Current position size vs. their average.
 *      Rationale: a big relative bet signals high-conviction, information-driven trade.
 */

import type { Holder, CredibilityScore, ScoreBreakdown } from './types';

export function calculateCredibilityScore(holder: Holder): CredibilityScore {
    const breakdown: ScoreBreakdown = {
        profit: calcProfitScore(holder.totalProfit),
        winRate: calcWinRateScore(holder.winRate, holder.totalMarkets),
        volume: calcVolumeScore(holder.totalMarkets),
        recency: calcRecencyScore(holder.lastTradeDate),
        conviction: calcConvictionScore(holder.currentPositionSize, holder.avgPositionSize),
    };

    const total =
        breakdown.profit +
        breakdown.winRate +
        breakdown.volume +
        breakdown.recency +
        breakdown.conviction;

    return {
        total: Math.round(total * 100) / 100,
        breakdown,
    };
}

// ─── Individual factor calculators ──────────────────────────────────────────────

/**
 * Profit Magnitude (0–40 pts)
 * Uses log₁₀ scale: log10(profit / 1000) * 13
 *   $5,000   → log10(5)  * 13 ≈ 9.1
 *   $50,000  → log10(50) * 13 ≈ 22.1
 *   $500,000 → log10(500)* 13 ≈ 35.1
 *   $1M+     → capped at 40
 */
function calcProfitScore(totalProfit: number): number {
    if (totalProfit <= 0) return 0;
    const raw = Math.log10(totalProfit / 1000) * 13;
    return Math.round(Math.min(40, Math.max(0, raw)) * 100) / 100;
}

/**
 * Win Rate (0–25 pts)
 * winRate ∈ [0, 100] → normalized to [0, 1], scaled by sample weight.
 * sampleWeight = min(1, totalMarkets / 20)
 * This means a wallet with < 20 markets has its win-rate score discounted.
 */
function calcWinRateScore(winRate: number, totalMarkets: number): number {
    if (totalMarkets === 0) return 0;
    const sampleWeight = Math.min(1, totalMarkets / 20);
    const raw = (winRate / 100) * 25 * sampleWeight;
    return Math.round(Math.max(0, raw) * 100) / 100;
}

/**
 * Trading Volume / Market Count (0–15 pts)
 * Sweet spot = 20–200 markets → full 15 pts.
 * < 20 markets   → proportional ramp-up.
 * > 200 markets  → slight penalty (12 pts) — could be a bot.
 */
function calcVolumeScore(totalMarkets: number): number {
    if (totalMarkets <= 0) return 0;
    if (totalMarkets >= 20 && totalMarkets <= 200) return 15;
    if (totalMarkets < 20) return Math.round((totalMarkets / 20) * 15 * 100) / 100;
    return 12; // 200+ markets
}

/**
 * Recency (0–10 pts)
 * ≤ 7 days  → 10 pts
 * ≤ 30 days → 7 pts
 * ≤ 90 days → 4 pts
 * > 90 days → 0 pts
 */
function calcRecencyScore(lastTradeDate: Date): number {
    const now = Date.now();
    const last = lastTradeDate.getTime();
    // If date is invalid or in the future, give benefit of the doubt
    if (isNaN(last) || last > now) return 10;

    const daysSince = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    if (daysSince <= 7) return 10;
    if (daysSince <= 30) return 7;
    if (daysSince <= 90) return 4;
    return 0;
}

/**
 * Position Conviction (0–10 pts)
 * Ratio = currentPositionSize / avgPositionSize
 * Score = min(10, ratio * 5)
 * A bet 2x their average → full 10 pts.
 */
function calcConvictionScore(currentSize: number, avgSize: number): number {
    if (avgSize <= 0 || currentSize <= 0) return 0;
    const ratio = currentSize / avgSize;
    return Math.round(Math.min(10, ratio * 5) * 100) / 100;
}
