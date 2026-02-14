/**
 * Analysis Pipeline
 *
 * Orchestrates the full flow:
 *   URL → event slug → market data → holders → enrich profiles → score → signal
 */

import { extractEventSlug, extractMarketSlug } from './url-parser';
import {
    fetchEventBySlug,
    fetchHolders,
    fetchUserPositions,
    fetchUserActivity,
    fetchUserLeaderboard,
    parseMarket,
} from './polymarket-api';
import { calculateCredibilityScore } from './scoring';
import { generateTradingSignal } from './signal';
import type {
    MarketInfo,
    Holder,
    ScoredHolder,
    AnalysisResult,
    HolderResponse,
} from './types';

/** Minimum total profit ($) for a holder to qualify as "smart money". */
const MIN_PROFIT_THRESHOLD = 5_000;

/**
 * Main entry point: analyzes a Polymarket URL and returns a trading signal.
 */
export async function analyzeMarket(url: string): Promise<AnalysisResult> {
    // 1. Parse URL
    const eventSlug = extractEventSlug(url);
    const marketSlug = extractMarketSlug(url);

    // 2. Fetch event data via Gamma API
    const event = await fetchEventBySlug(eventSlug);

    if (!event.markets || event.markets.length === 0) {
        throw new Error('No markets found for this event.');
    }

    // 3. Select the right market
    //    If a market slug is present in the URL, match it; otherwise use the first market.
    let rawMarket = event.markets[0];
    if (marketSlug) {
        const matched = event.markets.find((m) => m.slug === marketSlug);
        if (matched) rawMarket = matched;
    }

    const market = parseMarket(rawMarket);

    // 4. Fetch holders from Data API
    const holderResponses = await fetchHolders(market.conditionId);

    if (!holderResponses || holderResponses.length === 0) {
        return {
            market,
            signal: {
                signal: 'INCONCLUSIVE',
                confidence: 0,
                reasoning: 'No holder data available for this market.',
                data: null,
            },
        };
    }

    // 5. Map holders to YES/NO with token identification
    const holders = mapHoldersToPositions(holderResponses, market);

    if (holders.length === 0) {
        return {
            market,
            signal: {
                signal: 'INCONCLUSIVE',
                confidence: 0,
                reasoning: 'No holders found for this market.',
                data: null,
            },
        };
    }

    // 6. Enrich holder profiles (parallel, with concurrency limit)
    const enrichedHolders = await enrichHolders(holders);

    // 7. Filter by minimum profit threshold
    const qualifiedHolders = enrichedHolders.filter(
        (h) => h.totalProfit >= MIN_PROFIT_THRESHOLD
    );

    if (qualifiedHolders.length === 0) {
        return {
            market,
            signal: {
                signal: 'INCONCLUSIVE',
                confidence: 0,
                reasoning: `No holders meet the $${MIN_PROFIT_THRESHOLD.toLocaleString()} minimum profit threshold for this market. ${enrichedHolders.length} holders were analyzed.`,
                data: null,
            },
        };
    }

    // 8. Score each qualified holder
    const scoredHolders: ScoredHolder[] = qualifiedHolders.map((holder) => ({
        ...holder,
        credibilityScore: calculateCredibilityScore(holder),
    }));

    // 9. Sort by credibility score, take top 20
    const topHolders = scoredHolders
        .sort((a, b) => b.credibilityScore.total - a.credibilityScore.total)
        .slice(0, 20);

    // 10. Generate trading signal
    const signal = generateTradingSignal(topHolders);

    return { market, signal };
}

// ─── Internal Helpers ───────────────────────────────────────────────────────────

/**
 * Maps raw holder responses into Holder objects with YES/NO positions.
 * The Data API returns one HolderResponse per token. The first token in
 * clobTokenIds is typically YES, the second is NO.
 */
function mapHoldersToPositions(
    responses: HolderResponse[],
    market: MarketInfo
): Partial<Holder>[] {
    const holders: Partial<Holder>[] = [];
    const seenAddresses = new Set<string>();

    responses.forEach((resp, index) => {
        // Determine if this token is YES or NO
        // Heuristic: match token against clobTokenIds ordering
        let position: 'YES' | 'NO' = index === 0 ? 'YES' : 'NO';

        // If we have clobTokenIds, try to match
        if (market.clobTokenIds.length >= 2) {
            if (resp.token === market.clobTokenIds[0]) position = 'YES';
            else if (resp.token === market.clobTokenIds[1]) position = 'NO';
        }

        for (const rawHolder of resp.holders) {
            // Avoid duplicates (same address appearing in both tokens)
            if (seenAddresses.has(rawHolder.proxyWallet)) continue;
            seenAddresses.add(rawHolder.proxyWallet);

            holders.push({
                address: rawHolder.proxyWallet,
                username: rawHolder.username,
                currentPosition: position,
                currentPositionSize: rawHolder.amount || 0,
                shares: rawHolder.amount || 0,
            });
        }
    });

    return holders;
}

/**
 * Enriches partial holders with profile data from the Data API.
 * Uses parallel fetching with concurrency limit to avoid overwhelming the API.
 */
async function enrichHolders(partialHolders: Partial<Holder>[]): Promise<Holder[]> {
    const CONCURRENCY = 5;
    const results: Holder[] = [];

    for (let i = 0; i < partialHolders.length; i += CONCURRENCY) {
        const batch = partialHolders.slice(i, i + CONCURRENCY);
        const enriched = await Promise.all(batch.map(enrichSingleHolder));
        results.push(...enriched);
    }

    return results;
}

/**
 * Enriches a single holder with leaderboard + position data.
 */
async function enrichSingleHolder(partial: Partial<Holder>): Promise<Holder> {
    const address = partial.address || '';

    // Fetch leaderboard data and activity in parallel
    const [leaderboard, positions, activity] = await Promise.all([
        fetchUserLeaderboard(address),
        fetchUserPositions(address, 50),
        fetchUserActivity(address),
    ]);

    // Calculate total profit
    let totalProfit = 0;
    if (leaderboard) {
        totalProfit = leaderboard.pnl;
    } else if (positions.length > 0) {
        totalProfit = positions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
    }

    // Calculate total markets
    const totalMarkets = leaderboard?.marketsTraded || positions.length || 0;

    // Calculate win rate from positions
    let winRate = 0;
    if (positions.length > 0) {
        const wins = positions.filter((p) => p.cashPnl > 0).length;
        winRate = (wins / positions.length) * 100;
    }

    // Calculate average position size
    let avgPositionSize = 0;
    if (positions.length > 0) {
        const totalSize = positions.reduce((sum, p) => sum + Math.abs(p.initialValue || p.size || 0), 0);
        avgPositionSize = totalSize / positions.length;
    }

    // Determine last trade date
    let lastTradeDate = new Date(0);
    if (activity.length > 0 && activity[0].timestamp) {
        lastTradeDate = new Date(activity[0].timestamp);
    } else if (positions.length > 0) {
        // Fallback: assume recent if they have active positions
        lastTradeDate = new Date();
    }

    // Calculate total volume
    const totalVolume = leaderboard?.volume || 0;

    return {
        address,
        username: partial.username,
        totalProfit,
        totalVolume,
        totalMarkets,
        winRate,
        lastTradeDate,
        avgPositionSize,
        currentPosition: partial.currentPosition || 'YES',
        currentPositionSize: partial.currentPositionSize || 0,
        shares: partial.shares || 0,
    };
}
