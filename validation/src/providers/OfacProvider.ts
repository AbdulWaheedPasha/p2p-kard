// OFAC Sanctions Provider using sanctions.network API
// Free API covering OFAC SDN, UN Security Council, and EU sanctions lists

import type {
  ISanctionsProvider,
  SanctionsResult,
  SanctionsMatch,
} from '../types/index.js';

const API_BASE = 'https://api.sanctions.network';
const TIMEOUT_MS = 10000;

interface SanctionsNetworkResult {
  source: string;
  source_id: string;
  names: string[];
  created_at: string;
}

export class OfacProvider implements ISanctionsProvider {
  /**
   * Check a name against OFAC, UN, and EU sanctions lists
   */
  async checkSanctions(fullName: string, dateOfBirth?: string): Promise<SanctionsResult> {
    const checkedAt = new Date().toISOString();

    console.log(`[OFAC] Checking sanctions for: ${fullName}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const url = `${API_BASE}/rpc/search_sanctions?name=${encodeURIComponent(fullName)}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Sanctions API returned ${response.status}: ${response.statusText}`);
      }

      const results: SanctionsNetworkResult[] = await response.json();

      console.log(`[OFAC] Found ${results.length} potential matches`);

      // No matches = clear
      if (results.length === 0) {
        return {
          clear: true,
          isPep: false, // This API doesn't have PEP data
          matches: [],
          checkedAt,
        };
      }

      // Map results to our format
      const matches: SanctionsMatch[] = results.map((result) => ({
        listName: this.mapSourceToListName(result.source),
        matchScore: this.calculateMatchScore(fullName, result.names),
        matchedName: result.names[0] || 'Unknown',
        matchType: this.determineMatchType(fullName, result.names),
      }));

      return {
        clear: false,
        isPep: false,
        matches,
        checkedAt,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Sanctions check timed out after ${TIMEOUT_MS}ms`);
      }
      throw new Error(`Sanctions check failed: ${(error as Error).message}`);
    }
  }

  /**
   * Map API source to standard list name
   */
  private mapSourceToListName(source: string): string {
    switch (source.toLowerCase()) {
      case 'ofac':
        return 'OFAC';
      case 'unsc':
        return 'UN';
      case 'eu':
        return 'EU';
      default:
        return source.toUpperCase();
    }
  }

  /**
   * Calculate match score based on name similarity
   */
  private calculateMatchScore(searchName: string, matchedNames: string[]): number {
    const normalizedSearch = searchName.toLowerCase().trim();

    for (const name of matchedNames) {
      const normalizedMatch = name.toLowerCase().trim();

      // Exact match
      if (normalizedMatch.includes(normalizedSearch) || normalizedSearch.includes(normalizedMatch)) {
        return 100;
      }

      // Check individual name parts
      const searchParts = normalizedSearch.split(/\s+/);
      const matchParts = normalizedMatch.split(/[\s,]+/);

      const matchingParts = searchParts.filter(part =>
        matchParts.some(mp => mp.includes(part) || part.includes(mp))
      );

      if (matchingParts.length === searchParts.length) {
        return 90;
      }

      if (matchingParts.length > 0) {
        return Math.round((matchingParts.length / searchParts.length) * 80);
      }
    }

    // If API returned it, there's at least fuzzy similarity
    return 60;
  }

  /**
   * Determine match type based on similarity
   */
  private determineMatchType(searchName: string, matchedNames: string[]): 'exact' | 'partial' | 'fuzzy' {
    const normalizedSearch = searchName.toLowerCase().trim();

    for (const name of matchedNames) {
      const normalizedMatch = name.toLowerCase().trim();

      // Exact match
      if (normalizedMatch === normalizedSearch) {
        return 'exact';
      }

      // Partial match (one contains the other)
      if (normalizedMatch.includes(normalizedSearch) || normalizedSearch.includes(normalizedMatch)) {
        return 'partial';
      }
    }

    // API uses trigram fuzzy matching
    return 'fuzzy';
  }
}
