/**
 * ORBIT Excel Specialist — Data Cleaner & Normalization Engine (Level 1)
 * Cleans messy values, standardizes date formats, normalizes phone/emails,
 * and fixes mixed capitalization with high performance.
 */

export interface CleaningOptions {
  trimWhitespace?: boolean;
  normalizeCasing?: boolean;
  standardizeDates?: boolean;
  standardizePhones?: boolean;
  standardizeEmails?: boolean;
  dateTargetFormat?: 'YYYY-MM-DD' | 'MM/DD/YYYY';
}

export interface CleanedFieldResult<T = string | number | null> {
  value: T;
  wasModified: boolean;
  flaggedIssue?: string;
}

export class DataCleaner {
  public readonly options: Required<CleaningOptions>;

  constructor(options: CleaningOptions = {}) {
    this.options = {
      trimWhitespace: options.trimWhitespace ?? true,
      normalizeCasing: options.normalizeCasing ?? true,
      standardizeDates: options.standardizeDates ?? true,
      standardizePhones: options.standardizePhones ?? true,
      standardizeEmails: options.standardizeEmails ?? true,
      dateTargetFormat: options.dateTargetFormat ?? 'YYYY-MM-DD',
    };
  }

  /**
   * Cleans text: trims leading/trailing/multiple internal whitespace.
   */
  public cleanText(val: string): CleanedFieldResult<string> {
    if (!val || typeof val !== 'string') {
      return { value: val, wasModified: false };
    }
    const trimmed = val.replace(/\s+/g, ' ').trim();
    return {
      value: trimmed,
      wasModified: trimmed !== val,
    };
  }

  /**
   * Title-cases words, handling acronyms and special characters.
   */
  public titleCase(val: string): CleanedFieldResult<string> {
    if (!val || typeof val !== 'string') {
      return { value: val, wasModified: false };
    }
    const cleaned = this.cleanText(val).value;
    const titled = cleaned
      .toLowerCase()
      .split(' ')
      .map((word) => {
        if (word.length === 0) return '';
        // Retain uppercase for known acronyms (e.g., USA, UK, ID, SPR)
        if (['usa', 'uk', 'id', 'spr', 'po', 'hr', 'it', 'kpi', 'sku'].includes(word)) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');

    return {
      value: titled,
      wasModified: titled !== val,
    };
  }

  /**
   * Standardizes dates to ISO YYYY-MM-DD format from diverse formats:
   * MM/DD/YYYY, DD-MM-YYYY, YYYY/MM/DD, Mon DD YYYY, Excel serial timestamps.
   */
  public cleanDate(val: string | number): CleanedFieldResult<string> {
    if (val === null || val === undefined || String(val).trim() === '') {
      return { value: '', wasModified: false, flaggedIssue: 'MISSING_DATE' };
    }

    const str = String(val).trim();

    // Check if already in standard ISO format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return { value: str, wasModified: false };
    }

    // Try parsing Excel serial number (e.g. 45000)
    if (typeof val === 'number' || (/^\d{5}$/.test(str) && Number(str) > 30000 && Number(str) < 60000)) {
      const serial = Number(str);
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      const iso = dateInfo.toISOString().split('T')[0];
      return { value: iso, wasModified: true };
    }

    // Parse various common date patterns
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      // Year sanity check (1980 - 2040)
      if (yyyy >= 1980 && yyyy <= 2040) {
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        const standardized = `${yyyy}-${mm}-${dd}`;
        return { value: standardized, wasModified: standardized !== str };
      }
    }

    // Flag unparseable or impossible dates
    return {
      value: str,
      wasModified: false,
      flaggedIssue: 'INVALID_DATE_FORMAT',
    };
  }

  /**
   * Standardizes phone numbers to standard format or E.164.
   */
  public cleanPhone(val: string): CleanedFieldResult<string> {
    if (!val || typeof val !== 'string') {
      return { value: '', wasModified: false, flaggedIssue: 'MISSING_PHONE' };
    }

    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return {
        value: val.trim(),
        wasModified: false,
        flaggedIssue: 'INVALID_PHONE_LENGTH',
      };
    }

    // Standard 10-digit number format: (XXX) XXX-XXXX or +1-XXX-XXX-XXXX
    let formatted = val.trim();
    if (digitsOnly.length === 10) {
      formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      formatted = `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }

    return {
      value: formatted,
      wasModified: formatted !== val,
    };
  }

  /**
   * Standardizes email addresses (lowercased, whitespace removed, format validated).
   */
  public cleanEmail(val: string): CleanedFieldResult<string> {
    if (!val || typeof val !== 'string') {
      return { value: '', wasModified: false, flaggedIssue: 'MISSING_EMAIL' };
    }

    const cleaned = val.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleaned)) {
      return {
        value: cleaned,
        wasModified: cleaned !== val,
        flaggedIssue: 'INVALID_EMAIL_FORMAT',
      };
    }

    return {
      value: cleaned,
      wasModified: cleaned !== val,
    };
  }
}
