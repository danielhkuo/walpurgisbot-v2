// src/lib/archiveParser.ts

export interface ParseResult {
    detectedDays: number[];
    confidence: 'high' | 'low' | 'none';
}

/**
 * Parses a message content to find potential "Day" numbers.
 * - High confidence: "day" keyword is present.
 * - Low confidence: Only numbers are present, no "day" keyword.
 * @param content The message content to parse.
 * @returns A ParseResult object.
 */
export function parseMessageContent(content: string): ParseResult {
    // Regex to find numbers, optionally preceded by "day" or similar keywords.
    // Captures numbers that follow "day", "daily", "johan", etc.
    const highConfidenceRegex = /(?:day|daily|johan)\s*#?(\d+)/gi;
    // A simpler regex to find any standalone numbers if the high confidence one fails.
    const lowConfidenceRegex = /\b(\d+)\b/g;

    let matches;
    const detectedDays: number[] = [];

    // First, try for high-confidence matches
    matches = [...content.matchAll(highConfidenceRegex)];
    if (matches.length > 0) {
        for (const match of matches) {
            detectedDays.push(parseInt(match[1] ?? '0', 10));
        }
        return { detectedDays, confidence: 'high' };
    }

    // If no high-confidence matches, try for low-confidence
    matches = [...content.matchAll(lowConfidenceRegex)];
    if (matches.length > 0) {
        for (const match of matches) {
            detectedDays.push(parseInt(match[1] ?? '0', 10));
        }
        return { detectedDays, confidence: 'low' };
    }

    // No numbers found
    return { detectedDays: [], confidence: 'none' };
}