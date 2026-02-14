// Core data types for the Polymarket Smart Money Analyzer

// --- Polymarket API Response Types ---

export interface GammaEvent {
    id: string;
    slug: string;
    title: string;
    description: string;
    markets: GammaMarket[];
}

export interface GammaMarket {
    id: string;
    question: string;
    conditionId: string;
    slug: string;
    outcomes: string;        // JSON string like '["Yes","No"]'
    outcomePrices: string;   // JSON string like '[0.65,0.35]'
    clobTokenIds: string;    // JSON string like '["tokenId1","tokenId2"]'
    volume: string;
    liquidity: string;
    active: boolean;
    closed: boolean;
    acceptingOrders: boolean;
    enableOrderBook: boolean;
    endDate: string;
    startDate: string;
}

export interface HolderResponse {
    token: string;
    holders: RawHolder[];
}

export interface RawHolder {
    proxyWallet: string;
    amount: number;
    username?: string;
}

export interface UserPosition {
    conditionId: string;
    title: string;
    outcomeIndex: number;
    size: number;
    initialValue: number;
    currentValue: number;
    cashPnl: number;
    percentPnl: number;
    redeemable: boolean;
    mergeable: boolean;
    curPrice: number;
}

export interface LeaderboardEntry {
    rank: number;
    userAddress: string;
    username?: string;
    pnl: number;
    volume: number;
    marketsTraded: number;
}

// --- Internal Domain Types ---

export interface Holder {
    address: string;
    username?: string;
    totalProfit: number;
    totalVolume: number;
    totalMarkets: number;
    winRate: number;
    lastTradeDate: Date;
    avgPositionSize: number;

    // For THIS specific market:
    currentPosition: 'YES' | 'NO';
    currentPositionSize: number;
    shares: number;
}

export interface ScoreBreakdown {
    profit: number;
    winRate: number;
    volume: number;
    recency: number;
    conviction: number;
}

export interface CredibilityScore {
    total: number;
    breakdown: ScoreBreakdown;
}

export interface ScoredHolder extends Holder {
    credibilityScore: CredibilityScore;
}

export interface TradingSignal {
    signal: 'BUY YES' | 'BUY NO' | 'INCONCLUSIVE';
    confidence: number;
    reasoning: string;
    data: SignalData | null;
}

export interface SignalData {
    yesHolders: number;
    noHolders: number;
    yesValue: number;
    noValue: number;
    yesPercentage: number;
    whaleDetected: boolean;
    topHolders: HolderSummary[];
}

export interface HolderSummary {
    address: string;
    username?: string;
    score: number;
    scoreBreakdown: ScoreBreakdown;
    position: 'YES' | 'NO';
    size: number;
    profit: number;
    winRate: number;
    totalMarkets: number;
}

export interface MarketInfo {
    id: string;
    question: string;
    conditionId: string;
    slug: string;
    outcomes: string[];
    outcomePrices: number[];
    clobTokenIds: string[];
    volume: number;
    liquidity: number;
    active: boolean;
    closed: boolean;
    endDate: string;
}

export interface AnalysisResult {
    market: MarketInfo;
    signal: TradingSignal;
}

export interface AnalysisError {
    error: string;
    code?: string;
}
