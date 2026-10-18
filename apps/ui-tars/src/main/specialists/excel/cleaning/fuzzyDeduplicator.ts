/**
 * ORBIT Excel Specialist — Fuzzy Deduplication & Review Queue Engine (Level 1)
 * Detects exact duplicates and fuzzy matches using Jaro-Winkler & Levenshtein metrics.
 * Routes uncertain matches to an interactive Review Queue rather than guessing.
 */

export interface ReviewQueueItem {
  reviewId: string;
  sourceRid: number;
  matchedRid: number;
  field: string;
  originalValue: string;
  candidateValue: string;
  similarityScore: number;
  suggestedAction: 'MERGE' | 'KEEP_SEPARATE';
  suggestedResolvedValue?: string;
}

export interface DeduplicationResult {
  exactDuplicateRids: number[];
  reviewQueueItems: ReviewQueueItem[];
  reviewQueueRids: number[];
  uniqueRids: number[];
}

export class FuzzyDeduplicator {
  private exactThreshold: number = 0.95;
  private reviewThreshold: number = 0.75;

  constructor(exactThreshold: number = 0.95, reviewThreshold: number = 0.75) {
    this.exactThreshold = exactThreshold;
    this.reviewThreshold = reviewThreshold;
  }

  /**
   * Computes standard Levenshtein distance between two strings.
   */
  public levenshteinDistance(s1: string, s2: string): number {
    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();

    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1, // deletion
            ),
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Computes Jaro similarity metric.
   */
  private jaroSimilarity(s1: string, s2: string): number {
    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();

    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const matchWindow = Math.floor(Math.max(a.length, b.length) / 2) - 1;
    const aMatches = new Array(a.length).fill(false);
    const bMatches = new Array(b.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < a.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, b.length);

      for (let j = start; j < end; j++) {
        if (bMatches[j] || a[i] !== b[j]) continue;
        aMatches[i] = true;
        bMatches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    let k = 0;
    for (let i = 0; i < a.length; i++) {
      if (!aMatches[i]) continue;
      while (!bMatches[k]) k++;
      if (a[i] !== b[k]) transpositions++;
      k++;
    }

    return (
      (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3.0
    );
  }

  /**
   * Computes Jaro-Winkler similarity (favors common prefixes).
   */
  public jaroWinklerSimilarity(s1: string, s2: string): number {
    const jaro = this.jaroSimilarity(s1, s2);
    if (jaro < 0.7) return jaro;

    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();

    let prefixLength = 0;
    const maxPrefix = Math.min(4, Math.min(a.length, b.length));

    for (let i = 0; i < maxPrefix; i++) {
      if (a[i] === b[i]) {
        prefixLength++;
      } else {
        break;
      }
    }

    return parseFloat((jaro + prefixLength * 0.1 * (1 - jaro)).toFixed(4));
  }

  /**
   * Executes deduplication across a collection of records.
   * Discovers exact duplicates and routes uncertain matches to Review Queue.
   */
  public deduplicateRecords(
    records: Array<{ rid: number; keyField: string; payload?: any }>,
  ): DeduplicationResult {
    const exactDuplicates = new Set<number>();
    const reviewQueueItems: ReviewQueueItem[] = [];
    const reviewQueueRids = new Set<number>();
    const seenMap = new Map<string, { rid: number; originalStr: string }>();
    const bucketMap = new Map<string, Array<{ rid: number; originalStr: string }>>();

    for (const item of records) {
      const currentVal = item.keyField.trim();
      const normalizedKey = currentVal.toLowerCase();

      // Check 1: Exact match on normalized key
      if (seenMap.has(normalizedKey)) {
        exactDuplicates.add(item.rid);
        continue;
      }

      // Check 2: Fuzzy matching against candidate entries in the same initial-char bucket
      let matchedReview = false;
      const initialChar = normalizedKey.charAt(0);
      const candidates = bucketMap.get(initialChar) || [];

      for (const seenEntry of candidates) {
        const score = this.jaroWinklerSimilarity(currentVal, seenEntry.originalStr);

        if (score >= this.exactThreshold) {
          // Extremely high similarity -> Treat as exact duplicate
          exactDuplicates.add(item.rid);
          matchedReview = true;
          break;
        } else if (score >= this.reviewThreshold) {
          // Ambiguous zone (e.g. A. Sharma vs Ankit Sharma) -> Route to Review Queue
          reviewQueueItems.push({
            reviewId: `REV-${item.rid}-${seenEntry.rid}`,
            sourceRid: item.rid,
            matchedRid: seenEntry.rid,
            field: 'KeyField',
            originalValue: currentVal,
            candidateValue: seenEntry.originalStr,
            similarityScore: score,
            suggestedAction: currentVal.length > seenEntry.originalStr.length ? 'MERGE' : 'MERGE',
            suggestedResolvedValue:
              currentVal.length > seenEntry.originalStr.length ? currentVal : seenEntry.originalStr,
          });
          reviewQueueRids.add(item.rid);
          matchedReview = true;
          break;
        }
      }

      if (!matchedReview) {
        const entry = { rid: item.rid, originalStr: currentVal };
        seenMap.set(normalizedKey, entry);
        if (!bucketMap.has(initialChar)) {
          bucketMap.set(initialChar, []);
        }
        bucketMap.get(initialChar)!.push(entry);
      }
    }

    const uniqueRids: number[] = [];
    for (const item of records) {
      if (!exactDuplicates.has(item.rid) && !reviewQueueRids.has(item.rid)) {
        uniqueRids.push(item.rid);
      }
    }

    return {
      exactDuplicateRids: Array.from(exactDuplicates),
      reviewQueueItems,
      reviewQueueRids: Array.from(reviewQueueRids),
      uniqueRids,
    };
  }
}
