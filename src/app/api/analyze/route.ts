/**
 * POST /api/analyze
 *
 * Analyzes a Polymarket market and returns a trading signal.
 *
 * Request body: { url: string }
 * Response: AnalysisResult | AnalysisError
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeMarket } from '@/lib/analyze';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid "url" field. Please provide a Polymarket URL.' },
                { status: 400 }
            );
        }

        // Validate it looks like a Polymarket URL
        if (!url.includes('polymarket.com')) {
            return NextResponse.json(
                { error: 'Invalid URL. Please enter a valid Polymarket URL (e.g. https://polymarket.com/event/...)' },
                { status: 400 }
            );
        }

        const result = await analyzeMarket(url);
        return NextResponse.json(result);

    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        console.error('[/api/analyze] Error:', message);

        // Determine appropriate status code
        const status = message.includes('not found') ? 404
            : message.includes('Rate limited') ? 429
                : message.includes('Invalid') ? 400
                    : 500;

        return NextResponse.json({ error: message }, { status });
    }
}
