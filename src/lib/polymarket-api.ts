/**
 * Polymarket API client.
 *
 * Three APIs are used:
 *   1. Gamma API  — market discovery & metadata
 *   2. Data API   — holders, positions, leaderboard
 *   3. CLOB API   — live prices
 *
 * All endpoints are public & read-only (no auth required).
 */

import axios, { AxiosError } from 'axios';
import { cache, CACHE_TTL } from './cache';
import type {
    GammaEvent,
    GammaMarket,
    HolderResponse,
    MarketInfo,
    UserPosition,
} from './types';

// ─── Base URLs ──────────────────────────────────────────────────────────────────

const GAMMA_API = 'https://gamma-api.polymarket.com';
const DATA_API = 'https://data-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

// Axios defaults
const api = axios.create({ timeout: 10_000 });

// ─── Gamma API ──────────────────────────────────────────────────────────────────

/**
 * Fetch event by slug. Returns the event with all its markets.
 */
export async function fetchEventBySlug(slug: string): Promise<GammaEvent> {
    const cacheKey = `event:${slug}`;
    const cached = cache.get<GammaEvent>(cacheKey);
    if (cached) return cached;

    try {
        const { data } = await api.get<GammaEvent>(`${GAMMA_API}/events/slug/${slug}`);
        cache.set(cacheKey, data, CACHE_TTL.MARKET_DATA);
        return data;
    } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 404) {
            throw new Error(`Event not found: "${slug}". Please check the URL.`);
        }
        throw new Error(`Failed to fetch event data: ${(err as Error).message}`);
    }
}

/**
 * Alternatively search markets by slug.
 */
export async function fetchMarketBySlug(slug: string): Promise<GammaMarket | null> {
    try {
        const { data } = await api.get(`${GAMMA_API}/markets`, {
            params: { slug, limit: 1 },
        });
        const markets = Array.isArray(data) ? data : [];
        return markets[0] ?? null;
    } catch {
        return null;
    }
}

/**
 * Parse raw Gamma market into our clean MarketInfo type.
 */
export function parseMarket(raw: GammaMarket): MarketInfo {
    let outcomes: string[] = ['Yes', 'No'];
    let outcomePrices: number[] = [0.5, 0.5];
    let clobTokenIds: string[] = [];

    try { outcomes = JSON.parse(raw.outcomes); } catch { /* keep default */ }
    try { outcomePrices = JSON.parse(raw.outcomePrices).map(Number); } catch { /* keep default */ }
    try { clobTokenIds = JSON.parse(raw.clobTokenIds); } catch { /* keep default */ }

    // Build token→outcome map using the 1:1 index mapping from Polymarket API:
    // outcomes[i] corresponds to clobTokenIds[i]
    const outcomeForToken: Record<string, string> = {};
    for (let i = 0; i < Math.min(outcomes.length, clobTokenIds.length); i++) {
        outcomeForToken[clobTokenIds[i]] = outcomes[i];
    }

    return {
        id: raw.id,
        question: raw.question,
        conditionId: raw.conditionId,
        slug: raw.slug,
        outcomes,
        outcomePrices,
        clobTokenIds,
        outcomeForToken,
        volume: parseFloat(raw.volume) || 0,
        liquidity: parseFloat(raw.liquidity) || 0,
        active: raw.active,
        closed: raw.closed,
        endDate: raw.endDate,
    };
}

// ─── Data API ───────────────────────────────────────────────────────────────────

/**
 * Fetch top holders for a market (by conditionId).
 * Returns holders for each token (YES and NO).
 */
export async function fetchHolders(conditionId: string): Promise<HolderResponse[]> {
    const cacheKey = `holders:${conditionId}`;
    const cached = cache.get<HolderResponse[]>(cacheKey);
    if (cached) return cached;

    try {
        const { data } = await api.get<HolderResponse[]>(`${DATA_API}/holders`, {
            params: {
                market: conditionId,
                limit: 20,
                minBalance: 1,
            },
        });
        const result = Array.isArray(data) ? data : [];
        cache.set(cacheKey, result, CACHE_TTL.HOLDER_DATA);
        return result;
    } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 429) {
            throw new Error('Rate limited by Polymarket API. Please wait 1 minute and try again.');
        }
        throw new Error(`Failed to fetch holders: ${(err as Error).message}`);
    }
}

/**
 * Fetch a user's positions across all markets.
 * Used to compute total PNL and win rate.
 */
export async function fetchUserPositions(
    userAddress: string,
    limit = 100
): Promise<UserPosition[]> {
    const cacheKey = `positions:${userAddress}`;
    const cached = cache.get<UserPosition[]>(cacheKey);
    if (cached) return cached;

    try {
        const { data } = await api.get(`${DATA_API}/positions`, {
            params: {
                user: userAddress,
                sortBy: 'CURRENT',
                sortDirection: 'DESC',
                limit,
                sizeThreshold: 0,
            },
        });
        const positions: UserPosition[] = Array.isArray(data) ? data : [];
        cache.set(cacheKey, positions, CACHE_TTL.USER_PROFILE);
        return positions;
    } catch {
        // Non-fatal: we can still work without full position history
        return [];
    }
}

/**
 * Fetch a user's activity (trades) for recency analysis.
 */
export async function fetchUserActivity(
    userAddress: string
): Promise<{ timestamp: string }[]> {
    try {
        const { data } = await api.get(`${DATA_API}/activity`, {
            params: {
                user: userAddress,
                limit: 5,
                sortBy: 'TIMESTAMP',
                sortDirection: 'DESC',
            },
        });
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

/**
 * Fetch leaderboard data for a specific user by address.
 */
export async function fetchUserLeaderboard(
    userAddress: string
): Promise<{ pnl: number; volume: number; marketsTraded: number } | null> {
    const cacheKey = `leaderboard:${userAddress}`;
    const cached = cache.get<{ pnl: number; volume: number; marketsTraded: number }>(cacheKey);
    if (cached) return cached;

    try {
        const { data } = await api.get(`${DATA_API}/v1/leaderboard`, {
            params: {
                category: 'OVERALL',
                timePeriod: 'ALL',
                orderBy: 'PNL',
                userAddress,
                limit: 1,
            },
        });
        // Response may be an array or an object; normalize
        const entries = Array.isArray(data) ? data : (data?.leaderboard ?? []);
        if (entries.length === 0) return null;

        const entry = entries[0];

        // CRITICAL: Validate that the returned entry is actually for this user.
        // The Polymarket v1/leaderboard API may ignore userAddress and return
        // the global #1 trader instead. Check the proxyWallet matches.
        const returnedWallet = (entry.proxyWallet || '').toLowerCase();
        if (returnedWallet && returnedWallet !== userAddress.toLowerCase()) {
            // API returned data for a different user — discard it
            return null;
        }

        const result = {
            pnl: parseFloat(entry.pnl ?? entry.profit ?? 0),
            volume: parseFloat(entry.vol ?? entry.volume ?? 0),
            marketsTraded: parseInt(entry.marketsTraded ?? entry.markets ?? 0, 10),
        };
        cache.set(cacheKey, result, CACHE_TTL.USER_PROFILE);
        return result;
    } catch {
        return null;
    }
}

// ─── CLOB API ───────────────────────────────────────────────────────────────────

/**
 * Fetch current price for a token.
 */
export async function fetchPrice(tokenId: string): Promise<number> {
    const cacheKey = `price:${tokenId}`;
    const cached = cache.get<number>(cacheKey);
    if (cached !== null) return cached;

    try {
        const { data } = await api.get(`${CLOB_API}/price`, {
            params: { token_id: tokenId },
        });
        const price = typeof data === 'number' ? data : parseFloat(data?.price ?? '0.5');
        cache.set(cacheKey, price, CACHE_TTL.PRICE_DATA);
        return price;
    } catch {
        return 0.5; // Default to 50/50 if price fetch fails
    }
}
