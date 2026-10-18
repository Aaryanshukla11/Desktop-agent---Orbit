import { describe, it, expect } from 'vitest';
import { DataCleaner } from '../cleaning/dataCleaner';
import { FuzzyDeduplicator } from '../cleaning/fuzzyDeduplicator';
import { VerificationOracle } from '../core/verificationOracle';
import { LineageTracker } from '../core/lineageTracker';

describe('ORBIT Excel Specialist — Stage 03 (Level 1 Data Cleaning & Fuzzy Deduplication)', () => {
  const cleaner = new DataCleaner();
  const deduplicator = new FuzzyDeduplicator(0.95, 0.75);

  it('1. DataCleaner correctly trims whitespace and normalizes mixed capitalization', () => {
    const rawCategory = '   office    SUPPLIES   ';
    const cleaned = cleaner.titleCase(rawCategory);
    expect(cleaned.value).toBe('Office Supplies');
    expect(cleaned.wasModified).toBe(true);

    // Acronym preservation
    const acronymText = 'it   SUPPORT and  hr  MANAGEMENT';
    const cleanedAcronym = cleaner.titleCase(acronymText);
    expect(cleanedAcronym.value).toBe('IT Support And HR Management');
  });

  it('2. DataCleaner standardizes diverse messy dates to ISO YYYY-MM-DD', () => {
    // MM/DD/YYYY
    expect(cleaner.cleanDate('12/31/2023').value).toBe('2023-12-31');
    // Month name DD, YYYY
    expect(cleaner.cleanDate('October 15, 2024').value).toBe('2024-10-15');
    // Excel serial date 45200 (approx Oct 2023)
    const serialRes = cleaner.cleanDate(45200);
    expect(serialRes.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(serialRes.wasModified).toBe(true);

    // Invalid impossible date flagged
    const invalid = cleaner.cleanDate('not-a-date');
    expect(invalid.flaggedIssue).toBe('INVALID_DATE_FORMAT');
  });

  it('3. DataCleaner validates and formats phone numbers and emails', () => {
    // Phone numbers
    expect(cleaner.cleanPhone('1234567890').value).toBe('(123) 456-7890');
    expect(cleaner.cleanPhone('+1 (555) 234-5678').value).toBe('+1 (555) 234-5678');
    expect(cleaner.cleanPhone('123').flaggedIssue).toBe('INVALID_PHONE_LENGTH');

    // Email addresses
    expect(cleaner.cleanEmail('  John.Doe@ACME.Com  ').value).toBe('john.doe@acme.com');
    expect(cleaner.cleanEmail('invalid-email-address').flaggedIssue).toBe('INVALID_EMAIL_FORMAT');
  });

  it('4. FuzzyDeduplicator accurately calculates Jaro-Winkler similarity on edge-cases', () => {
    // Exact match
    expect(deduplicator.jaroWinklerSimilarity('Acme Corp', 'Acme Corp')).toBe(1.0);

    // High similarity prefix-match
    const score1 = deduplicator.jaroWinklerSimilarity('A. Sharma', 'Ankit Sharma');
    expect(score1).toBeGreaterThanOrEqual(0.75);
    expect(score1).toBeLessThan(0.95);

    // Minor typo
    const score2 = deduplicator.jaroWinklerSimilarity('Jon Smith', 'John Smith');
    expect(score2).toBeGreaterThanOrEqual(0.85);

    // Completely distinct
    const score3 = deduplicator.jaroWinklerSimilarity('Microsoft', 'Apple');
    expect(score3).toBeLessThan(0.5);
  });

  it('5. 10,000 Messy Rows Scale Benchmark with strict MECE Partitioning', () => {
    const totalRecords = 10000;
    const lineage = new LineageTracker();
    const rids = lineage.ingest(totalRecords);

    const firstNames = ['Aarav', 'Ankit', 'Pooja', 'Rahul', 'Sneha', 'Vikram', 'Neha', 'Rohan'];
    const lastNames = ['Sharma', 'Verma', 'Patel', 'Singh', 'Gupta', 'Kumar', 'Reddy', 'Mehta'];

    // Generate 10,000 synthetic records with intentional messy artifacts
    const records: Array<{ rid: number; keyField: string; payload: any }> = [];
    for (let i = 0; i < totalRecords; i++) {
      const rid = rids[i];
      let name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;

      // Injected defects:
      if (i % 25 === 0) {
        name = `  ${name.toLowerCase()}  `; // whitespace + lowercase
      } else if (i % 50 === 0) {
        name = `A. ${lastNames[i % lastNames.length]}`; // fuzzy abbreviation
      } else if (i % 100 === 0) {
        name = `${firstNames[i % firstNames.length]}  ${lastNames[i % lastNames.length]}`; // double space
      }

      records.push({
        rid,
        keyField: name,
        payload: {
          email: `user${i}@example.com`,
          phone: '5551234567',
        },
      });
    }

    const tStart = Date.now();
    // Step A: Clean and normalize all 10,000 strings
    const cleanedRecords = records.map((r) => ({
      rid: r.rid,
      keyField: cleaner.titleCase(r.keyField).value,
      payload: {
        email: cleaner.cleanEmail(r.payload.email).value,
        phone: cleaner.cleanPhone(r.payload.phone).value,
      },
    }));

    // Step B: Run Deduplication
    const dedupResult = deduplicator.deduplicateRecords(cleanedRecords);
    const elapsedMs = Date.now() - tStart;

    console.log(`\n--- 10,000 ROWS CLEANING BENCHMARK ---`);
    console.log(`Execution Time: ${elapsedMs}ms for 10,000 rows`);
    console.log(`Unique Records: ${dedupResult.uniqueRids.length}`);
    console.log(`Exact Duplicates: ${dedupResult.exactDuplicateRids.length}`);
    console.log(`Review Queue Routed: ${dedupResult.reviewQueueRids.length}`);

    // Verify MECE Invariant: Unique + ExactDuplicates + ReviewQueue == Total 10,000
    const partition = {
      inputTotal: totalRecords,
      cleanedCount: dedupResult.uniqueRids.length,
      deduplicatedCount: dedupResult.exactDuplicateRids.length,
      rejectedCount: 0,
      reviewQueueCount: dedupResult.reviewQueueRids.length,
    };

    const meceCheck = VerificationOracle.verifyMecePartition(partition);
    expect(meceCheck.isValid).toBe(true);
    expect(meceCheck.sum).toBe(10000);
    expect(meceCheck.difference).toBe(0);

    // Performance assertion: 10,000 rows cleaned & deduplicated in under 2.5 seconds
    expect(elapsedMs).toBeLessThan(2500);
  });

  it('6. Fuzzy Deduplication routes ambiguous pairs to Review Queue with suggested actions', () => {
    const records = [
      { rid: 1, keyField: 'Ankit Sharma' },
      { rid: 2, keyField: 'A. Sharma' }, // ambiguous match with rid 1 -> Review Queue
      { rid: 3, keyField: 'Vikram Singh' },
      { rid: 4, keyField: 'Vikram Singh' }, // exact duplicate of rid 3 -> Exact Duplicate
      { rid: 5, keyField: 'Pooja Verma' },
      { rid: 6, keyField: 'Puja Verma' }, // ambiguous typo with rid 5 -> Review Queue
    ];

    const result = deduplicator.deduplicateRecords(records);

    expect(result.uniqueRids).toEqual([1, 3, 5]);
    expect(result.exactDuplicateRids).toEqual([4]);
    expect(result.reviewQueueRids).toEqual([2, 6]);
    expect(result.reviewQueueItems.length).toBe(2);

    // Verify first review queue item (Ankit vs A. Sharma)
    const item1 = result.reviewQueueItems[0];
    expect(item1.candidateValue).toBe('Ankit Sharma');
    expect(item1.originalValue).toBe('A. Sharma');
    expect(item1.similarityScore).toBeGreaterThanOrEqual(0.75);
    expect(item1.similarityScore).toBeLessThan(0.95);

    // MECE partition assertion
    const partition = {
      inputTotal: records.length,
      cleanedCount: result.uniqueRids.length,
      deduplicatedCount: result.exactDuplicateRids.length,
      rejectedCount: 0,
      reviewQueueCount: result.reviewQueueRids.length,
    };
    const mece = VerificationOracle.verifyMecePartition(partition);
    expect(mece.isValid).toBe(true);
    expect(mece.sum).toBe(6);
  });
});

