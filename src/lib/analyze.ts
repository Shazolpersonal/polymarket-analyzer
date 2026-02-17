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
// Holders with position size below $100 and no significant profit are excluded

/**
 * Main entry point: analyzes a Polymarket URL and returns a trading signal.
 */
export async function analyzeMarket(url: string): Promise<AnalysisResult> {
    const warnings: string[] = [];

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

    // Check if market price parsing used fallback defaults
    if (market.outcomePrices[0] === 0.5 && market.outcomePrices[1] === 0.5) {
        // Could be genuine 50/50 or could be a parse failure — flag for transparency
        warnings.push('Market prices show 50/50 — this may indicate price data could not be parsed.');
    }

    // 4. Fetch holders from Data API
    const holderResponses = await fetchHolders(market.conditionId);

    if (!holderResponses || holderResponses.length === 0) {
        return {
            market,
            warnings: ['No holder data available from the API.'],
            signal: {
                signal: 'INCONCLUSIVE',
                confidence: 0,
                reasoning: 'No holder data available for this market.',
                data: null,
            },
        };
    }

    // 5. Map holders to YES/NO with token identification
    const { holders, mappingWarnings } = mapHoldersToPositions(holderResponses, market);
    warnings.push(...mappingWarnings);

    if (holders.length === 0) {
        return {
            market,
            warnings,
            signal: {
                signal: 'INCONCLUSIVE',
                confidence: 0,
                reasoning: 'No holders found for this market.',
                data: null,
            },
        };
    }

    // 6. Enrich holder profiles (parallel, with concurrency limit)
    const { enriched, enrichmentWarnings } = await enrichHolders(holders);
    warnings.push(...enrichmentWarnings);

    // 7. Filter: keep holders with meaningful position size OR established profit
    // Position size is always reliable (from holders API × market price).
    // totalProfit may be 0 for most holders because per-user APIs are unreliable.
    const MIN_POSITION_SIZE = 100;   // $100 minimum position value
    const MIN_PROFIT_ALT = 1_000;    // $1K profit (if we got enrichment data)
    const qualifiedHolders = enriched.filter(
        (h) => h.currentPositionSize >= MIN_POSITION_SIZE || h.totalProfit >= MIN_PROFIT_ALT
    );

    // Warn if many holders have no enrichment data
    const holdersWithNoData = enriched.filter(
        (h) => h.totalProfit === 0 && h.totalMarkets === 0
    ).length;
    if (holdersWithNoData > enriched.length * 0.5) {
        warnings.push(
            `${holdersWithNoData} of ${enriched.length} holders had no historical data — scores are based primarily on position size.`
        );
    }

    if (qualifiedHolders.length === 0) {
        return {
            market,
            warnings,
            signal: {
                signal: 'INCONCLUSIVE',
                confidence: 0,
                reasoning: `No holders have sufficient position size or profit in this market. ${enriched.length} holders were analyzed.`,
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

    return { market, signal, warnings };
}

// ─── Internal Helpers ───────────────────────────────────────────────────────────

/**
 * Maps raw holder responses into Holder objects with YES/NO positions.
 * Uses the outcomeForToken map for deterministic mapping (from Gamma API's
 * 1:1 outcomes[i] ↔ clobTokenIds[i] relationship).
 *
 * Also converts share counts to dollar values using market prices.
 */
function mapHoldersToPositions(
    responses: HolderResponse[],
    market: MarketInfo
): { holders: Partial<Holder>[]; mappingWarnings: string[] } {
    const holders: Partial<Holder>[] = [];
    const seenAddresses = new Set<string>();
    const mappingWarnings: string[] = [];
    let usedFallback = false;

    // Build a price lookup: outcome name → price
    const priceForOutcome: Record<string, number> = {};
    for (let i = 0; i < market.outcomes.length; i++) {
        priceForOutcome[market.outcomes[i]] = market.outcomePrices[i] ?? 0.5;
    }

    responses.forEach((resp, index) => {
        // Determine if this token is YES or NO
        // Priority 1: Use the deterministic outcomeForToken map
        let outcomeName = market.outcomeForToken[resp.token];
        let position: 'YES' | 'NO';

        if (outcomeName) {
            // Deterministic match via Gamma API's token→outcome mapping
            position = outcomeName.toUpperCase() === 'YES' ? 'YES' : 'NO';
        } else {
            // Fallback: index-based guess (less reliable)
            position = index === 0 ? 'YES' : 'NO';
            outcomeName = market.outcomes[index] ?? (index === 0 ? 'Yes' : 'No');
            usedFallback = true;
        }

        // Get the price for this outcome to convert shares → dollar value
        const price = priceForOutcome[outcomeName] ?? 0.5;

        for (const rawHolder of resp.holders) {
            // Avoid duplicates (same address appearing in both tokens)
            if (seenAddresses.has(rawHolder.proxyWallet)) continue;
            seenAddresses.add(rawHolder.proxyWallet);

            const shareCount = rawHolder.amount || 0;

            holders.push({
                address: rawHolder.proxyWallet,
                username: rawHolder.username,
                currentPosition: position,
                currentPositionSize: shareCount * price,  // Dollar value
                shares: shareCount,
            });
        }
    });

    if (usedFallback) {
        mappingWarnings.push(
            'Position mapping used index-based fallback for some tokens — YES/NO detection may be less accurate.'
        );
    }

    return { holders, mappingWarnings };
}

/**
 * Enriches partial holders with profile data from the Data API.
 * Uses parallel fetching with concurrency limit to avoid overwhelming the API.
 */
async function enrichHolders(
    partialHolders: Partial<Holder>[]
): Promise<{ enriched: Holder[]; enrichmentWarnings: string[] }> {
    const CONCURRENCY = 10;
    const results: Holder[] = [];
    const enrichmentWarnings: string[] = [];
    let incompleteProfiles = 0;

    for (let i = 0; i < partialHolders.length; i += CONCURRENCY) {
        const batch = partialHolders.slice(i, i + CONCURRENCY);
        const enriched = await Promise.all(batch.map(enrichSingleHolder));
        for (const holder of enriched) {
            if (holder.totalMarkets === 0 && holder.totalProfit === 0) {
                incompleteProfiles++;
            }
            results.push(holder);
        }
    }

    if (incompleteProfiles > 0) {
        enrichmentWarnings.push(
            `${incompleteProfiles} of ${partialHolders.length} holders had incomplete profile data.`
        );
    }

    return { enriched: results, enrichmentWarnings };
}

/**
 * Enriches a single holder with leaderboard + position data.
 *
 * NOTE: External APIs are unreliable — many users return empty data or
 * inflated values. The code defensively handles all failure modes.
 */
async function enrichSingleHolder(partial: Partial<Holder>): Promise<Holder> {
    const address = partial.address || '';

    // Fetch leaderboard data and activity in parallel
    const [leaderboard, positions, activity] = await Promise.all([
        fetchUserLeaderboard(address),
        fetchUserPositions(address, 50),
        fetchUserActivity(address),
    ]);

    // --- Total Profit ---
    // Priority: leaderboard (if it passed the wallet-match check) > positions > 0
    let totalProfit = 0;
    if (leaderboard) {
        totalProfit = leaderboard.pnl;
    } else if (positions.length > 0) {
        // Sum cashPnl from positions, but cap at a sanity limit to avoid
        // inflated values from the API (e.g. raw share counts misreported as PnL)
        const rawPnl = positions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
        // Only trust if PnL is within a reasonable range (< $50M)
        totalProfit = Math.abs(rawPnl) < 50_000_000 ? rawPnl : 0;
    }

    // --- Total Markets ---
    const totalMarkets = leaderboard?.marketsTraded || positions.length || 0;

    // --- Win Rate ---
    let winRate = 0;
    const positionsSampled = positions.length;
    if (positions.length > 0) {
        const wins = positions.filter((p) => (p.cashPnl || 0) > 0).length;
        winRate = (wins / positions.length) * 100;
    }

    // --- Average Position Size ---
    let avgPositionSize = 0;
    if (positions.length > 0) {
        const totalSize = positions.reduce(
            (sum, p) => sum + Math.abs(p.initialValue || p.size || 0),
            0
        );
        avgPositionSize = totalSize / positions.length;
        // Sanity cap: if avg size exceeds $10M, it's likely raw shares not dollars
        if (avgPositionSize > 10_000_000) avgPositionSize = 0;
    }

    // --- Last Trade Date ---
    let lastTradeDate = new Date(0);
    if (activity.length > 0 && activity[0].timestamp) {
        const ts = activity[0].timestamp;
        // Handle both ISO strings and unix epoch numbers
        const parsed = typeof ts === 'number'
            ? new Date(ts > 1e12 ? ts : ts * 1000)
            : new Date(ts);
        if (!isNaN(parsed.getTime())) lastTradeDate = parsed;
    } else if (positions.length > 0) {
        // Fallback: assume recent if they have active positions
        lastTradeDate = new Date();
    }

    // --- Total Volume ---
    const totalVolume = leaderboard?.volume || 0;

    return {
        address,
        username: partial.username,
        totalProfit,
        totalVolume,
        totalMarkets,
        winRate,
        positionsSampled,
        lastTradeDate,
        avgPositionSize,
        currentPosition: partial.currentPosition || 'YES',
        currentPositionSize: partial.currentPositionSize || 0,
        shares: partial.shares || 0,
    };
}
