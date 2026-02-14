# Polymarket Smart Money Analyzer

Identify profitable traders ("smart money") on Polymarket and follow their positions. Paste any Polymarket event URL and get an actionable trading signal: **BUY YES**, **BUY NO**, or **INCONCLUSIVE**.

---

## How It Works

```
INPUT:  Polymarket event URL (e.g. https://polymarket.com/event/presidential-election-winner-2028)
  ↓
STEP 1: Extract event slug → fetch market metadata via Gamma API
STEP 2: Fetch top holders for the market via Data API
STEP 3: Enrich each holder with PNL, win rate, trade history
STEP 4: Filter holders with $5,000+ total profit
STEP 5: Score each holder on credibility (0–100)
STEP 6: Analyze top 20 holders' positions (YES vs NO)
STEP 7: Generate trading signal with confidence score
  ↓
OUTPUT: Signal + Confidence + Reasoning + Holder breakdown table
```

## Credibility Scoring Algorithm

Five-factor score (0–100):

| Factor | Weight | Logic |
|--------|--------|-------|
| **Profit Magnitude** | 40 pts | Logarithmic scale: $5K ≈ 10pts, $50K ≈ 30pts, $500K+ ≈ 40pts |
| **Win Rate** | 25 pts | Adjusted for sample size — need 20+ markets for full weight |
| **Trading Volume** | 15 pts | Sweet spot: 20–200 markets. Penalizes likely bots (500+) |
| **Recency** | 10 pts | ≤7 days = full points, decays over 30/90 days |
| **Position Conviction** | 10 pts | Current position size relative to their average bet size |

**Why these weights?** Profit magnitude is weighted heaviest (40%) because a wallet with $500K+ profit has a _proven_ edge. We use logarithmic scaling because $500K isn't 100x better than $5K in terms of credibility — it's roughly 4x better. Win rate is adjusted for sample size because 80% on 10 markets is far less reliable than 60% on 100 markets.

## Signal Generation

- Top 20 holders by score are analyzed
- YES vs NO split computed by position value (not just count)
- **BUY YES**: ≥65% in YES by value AND confidence ≥ 5
- **BUY NO**: ≤35% in YES by value AND confidence ≥ 5
- **INCONCLUSIVE**: divided or insufficient data
- **Whale Detection**: if a single holder controls >40% of total analyzed value → confidence is reduced by 3 points

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **APIs Used**:
  - Gamma API (`gamma-api.polymarket.com`) — market metadata
  - Data API (`data-api.polymarket.com`) — holders, positions, leaderboard
  - CLOB API (`clob.polymarket.com`) — live prices
- **No API keys required** — all endpoints are public and read-only

## Local Setup

### Prerequisites
- Node.js 18+ installed
- npm

### Steps
```bash
# 1. Clone repository
git clone <your-repo>
cd polymarket-analyzer

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev

# 4. Open http://localhost:3000
```

## How to Use

1. Go to [polymarket.com](https://polymarket.com) and find a market
2. Copy the full URL (e.g. `https://polymarket.com/event/presidential-election-winner-2028`)
3. Paste into the input field
4. Click **Analyze**
5. Review the signal, confidence score, reasoning, and holder breakdown

### Example Markets to Try
- [Presidential Election Winner 2028](https://polymarket.com/event/presidential-election-winner-2028)
- [Democratic Presidential Nominee 2028](https://polymarket.com/event/democratic-presidential-nominee-2028)
- [2026 NBA Champion](https://polymarket.com/event/2026-nba-champion)

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main UI page
│   ├── layout.tsx            # Root layout with SEO
│   └── api/analyze/route.ts  # POST endpoint for analysis
├── lib/
│   ├── types.ts              # TypeScript interfaces
│   ├── url-parser.ts         # Polymarket URL parsing
│   ├── cache.ts              # In-memory TTL cache
│   ├── polymarket-api.ts     # API clients (Gamma, Data, CLOB)
│   ├── scoring.ts            # 5-factor credibility scoring
│   ├── signal.ts             # Signal generation + whale detection
│   └── analyze.ts            # Orchestration pipeline
└── components/
    ├── MarketInput.tsx        # URL input form
    ├── MarketHeader.tsx       # Market question + prices
    ├── SignalCard.tsx         # Signal display with confidence bar
    ├── HolderTable.tsx        # Top holders breakdown table
    └── ScoreBreakdown.tsx     # Per-factor score visualization
```

## Known Limitations

- **Holder data capped at 20 per token** — Polymarket Data API limits `/holders` to 20 results per request
- **Profile enrichment is serial-batched** — fetching each holder's full history takes 5–15 seconds total
- **Position sizes from API are share counts** — not always directly convertible to USD without price context
- **Multi-market events** — for events with many sub-markets, only the first (or URL-matched) market is analyzed
- **In-memory cache** — resets on server restart; not suitable for production scale

## Future Improvements

- Category expertise scoring (a wallet's track record in political vs sports markets)
- Historical signal backtesting
- Redis/persistent cache for production
- WebSocket for live price updates
- Portfolio-level analysis (multiple markets at once)
- Export analysis as PDF/image
