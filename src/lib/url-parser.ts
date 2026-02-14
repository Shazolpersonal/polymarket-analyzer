/**
 * Extracts the event slug from a Polymarket URL.
 *
 * Supported formats:
 *   https://polymarket.com/event/trump-2028
 *   https://polymarket.com/event/trump-2028?tid=123
 *   https://www.polymarket.com/event/trump-2028/will-trump-run
 *   polymarket.com/event/some-slug
 */
export function extractEventSlug(url: string): string {
    // Normalize
    const trimmed = url.trim();

    // Quick validation
    if (!trimmed.includes('polymarket.com')) {
        throw new Error(
            'Invalid URL: Please enter a valid Polymarket URL (e.g. https://polymarket.com/event/...)'
        );
    }

    // Match /event/{slug} pattern
    const match = trimmed.match(/polymarket\.com\/event\/([^/?#]+)/);
    if (!match || !match[1]) {
        throw new Error(
            'Could not extract event slug from URL. Expected format: https://polymarket.com/event/{slug}'
        );
    }

    return match[1];
}

/**
 * Extracts an optional market slug (sub-path after event slug).
 * e.g. /event/trump-2028/will-trump-win → marketSlug = "will-trump-win"
 */
export function extractMarketSlug(url: string): string | null {
    const trimmed = url.trim();
    const match = trimmed.match(/polymarket\.com\/event\/[^/?#]+\/([^/?#]+)/);
    return match ? match[1] : null;
}
