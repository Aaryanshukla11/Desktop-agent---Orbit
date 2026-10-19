import { SettingStore } from '../../../store/setting';
import { logger } from '../../../logger';
import { UniversalExcelPlan, UniversalDatasetPlanner } from './universalGenerator';

export interface ContinuationPlan {
  newHeaders: string[];
  rows: (string | number)[][];
  explanation: string;
}

export class AiExcelPlanner {
  public async plan(instructions: string, onProgress?: (status: string, percentage: number) => void): Promise<UniversalExcelPlan> {
    onProgress?.('AI analyzing prompt and architecting custom Excel schema...', 8);
    const settings = SettingStore.getStore();

    let baseUrl = settings.vlmBaseUrl?.trim() || process.env.VLM_BASE_URL || process.env.OPENAI_BASE_URL || '';
    const apiKey = settings.vlmApiKey?.trim() || process.env.VLM_API_KEY || process.env.OPENAI_API_KEY || '';
    const model = settings.vlmModelName?.trim() || process.env.VLM_MODEL_NAME || process.env.OPENAI_MODEL_NAME || 'gpt-4o';

    if (!baseUrl) {
      baseUrl = apiKey ? 'https://api.openai.com/v1' : '';
    }

    // If we have an AI endpoint and API key, call the LLM!
    if (baseUrl && apiKey) {
      try {
        logger.info(`[AiExcelPlanner] Querying LLM (${model} @ ${baseUrl}) for instruction: "${instructions}"`);
        const aiPlan = await this.queryLlm(instructions, baseUrl, apiKey, model);
        if (aiPlan) {
          logger.info(`[AiExcelPlanner] Successfully received AI-generated plan for "${aiPlan.domainName}" with ${aiPlan.rows.length} rows.`);
          onProgress?.(`AI generated schema for "${aiPlan.domainName}" (${aiPlan.headers.length} columns, ${aiPlan.rows.length} rows).`, 15);
          return aiPlan;
        }
      } catch (err: any) {
        logger.warn(`[AiExcelPlanner] LLM call failed (${err?.message || err}). Falling back to Universal Planner.`);
      }
    } else {
      logger.info('[AiExcelPlanner] No VLM API key configured in settings. Using Universal Autonomous Planner.');
    }

    // Fallback to Universal Planner
    const fallback = new UniversalDatasetPlanner();
    return fallback.plan(instructions);
  }

  public async planContinuation(
    instructions: string,
    existingHeaders: string[],
    targetRowCount: number,
    onProgress?: (status: string, percentage: number) => void,
  ): Promise<ContinuationPlan> {
    onProgress?.('AI analyzing existing table schema and generating multi-column dataset...', 20);
    const settings = SettingStore.getStore();

    let baseUrl = settings.vlmBaseUrl?.trim() || process.env.VLM_BASE_URL || process.env.OPENAI_BASE_URL || '';
    const apiKey = settings.vlmApiKey?.trim() || process.env.VLM_API_KEY || process.env.OPENAI_API_KEY || '';
    const model = settings.vlmModelName?.trim() || process.env.VLM_MODEL_NAME || process.env.OPENAI_MODEL_NAME || 'gpt-4o';

    if (!baseUrl) {
      baseUrl = apiKey ? 'https://api.openai.com/v1' : '';
    }

    if (baseUrl && apiKey) {
      try {
        const aiRes = await this.queryLlmContinuation(instructions, existingHeaders, targetRowCount, baseUrl, apiKey, model);
        if (aiRes && aiRes.newHeaders.length > 0 && aiRes.rows.length > 0) {
          onProgress?.(`AI created ${aiRes.newHeaders.length} columns across ${targetRowCount} rows.`, 40);
          return aiRes;
        }
      } catch (err: any) {
        logger.warn(`[AiExcelPlanner] LLM continuation failed (${err?.message || err}). Using intelligent domain generator.`);
      }
    }

    return this.generateFallbackContinuation(instructions, existingHeaders, targetRowCount);
  }

  private async queryLlmContinuation(
    instructions: string,
    existingHeaders: string[],
    targetRowCount: number,
    baseUrl: string,
    apiKey: string,
    model: string,
  ): Promise<ContinuationPlan | null> {
    let cleanUrl = baseUrl.replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/chat/completions')) {
      if (!cleanUrl.endsWith('/v1')) {
        cleanUrl = `${cleanUrl}/v1/chat/completions`;
      } else {
        cleanUrl = `${cleanUrl}/chat/completions`;
      }
    }

    const systemPrompt = `You are an Autonomous Excel Architect AI. Given an active worksheet's existing columns and row count, design all the requested new columns and generate complete, authentic data rows.
Return strictly a valid JSON object without any Markdown formatting or code fences.

JSON Schema:
{
  "newHeaders": ["Col 1", "Col 2", "Col 3"],
  "sampleRows": [
    ["Val 1", "Val 2", 85],
    ["Val 3", "Val 4", 92]
  ],
  "explanation": "Brief description of the added columns"
}
Rules:
1. "newHeaders" must contain ALL new columns requested by the user prompt (can be 1 to 10 columns).
2. "sampleRows" must contain 10-25 authentic sample rows matching the new headers.
3. Numeric columns (marks, scores, sales, salary, percent) must be numbers.
4. Output only valid JSON.`;

    const userPrompt = `Existing Headers in Worksheet: [${existingHeaders.join(', ')}]
Total Rows in Worksheet: ${targetRowCount}
User Instruction: "${instructions}"

Design all new columns and sample rows now.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) return null;
      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      const cleanedJson = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleanedJson);
      if (!Array.isArray(parsed.newHeaders) || parsed.newHeaders.length === 0) return null;

      const sampleRows = Array.isArray(parsed.sampleRows) ? parsed.sampleRows : [];
      const expandedRows: (string | number)[][] = [];

      for (let i = 0; i < targetRowCount; i++) {
        if (sampleRows.length > 0) {
          const tpl = sampleRows[i % sampleRows.length];
          expandedRows.push(
            tpl.map((val: any) => {
              if (typeof val === 'number') {
                const jitter = 0.9 + ((i * 13) % 21) / 100;
                return parseFloat((val * jitter).toFixed(2));
              }
              return val;
            }),
          );
        } else {
          expandedRows.push(parsed.newHeaders.map(() => `Item ${i + 1}`));
        }
      }

      return {
        newHeaders: parsed.newHeaders,
        rows: expandedRows,
        explanation: parsed.explanation || `Added ${parsed.newHeaders.length} columns: ${parsed.newHeaders.join(', ')}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private generateFallbackContinuation(
    instructions: string,
    _existingHeaders: string[],
    targetRowCount: number,
  ): ContinuationPlan {
    const lower = instructions.toLowerCase();
    const newHeaders: string[] = [];
    const rows: (string | number)[][] = [];
    let explanation = '';

    if (lower.includes('mark') || lower.includes('subject') || lower.includes('exam') || lower.includes('score')) {
      newHeaders.push('Mathematics', 'Physics', 'Chemistry', 'English', 'Computer Science', 'Total Marks', 'Percentage (%)', 'Grade');
      explanation = 'Multi-subject examination scorecard (Marks out of 80, Total, Percentage, and Grade)';
      for (let i = 0; i < targetRowCount; i++) {
        const m1 = 45 + ((i * 17 + 23) % 36);
        const m2 = 40 + ((i * 19 + 17) % 41);
        const m3 = 42 + ((i * 13 + 31) % 39);
        const m4 = 50 + ((i * 11 + 19) % 31);
        const m5 = 48 + ((i * 23 + 13) % 33);
        const total = m1 + m2 + m3 + m4 + m5;
        const pct = parseFloat(((total / 400) * 100).toFixed(1));
        const grade = pct >= 85 ? 'A+' : pct >= 75 ? 'A' : pct >= 65 ? 'B' : pct >= 50 ? 'C' : 'D';
        rows.push([m1, m2, m3, m4, m5, total, pct, grade]);
      }
    } else if (lower.includes('contact') || lower.includes('phone') || lower.includes('email') || lower.includes('address') || lower.includes('lead') || lower.includes('client')) {
      newHeaders.push('Contact Number', 'Email Address', 'City', 'Country', 'Status');
      explanation = 'Complete contact directory records (Phone, Email, City, Country, Status)';
      const cities = ['New York', 'San Francisco', 'London', 'Berlin', 'Tokyo', 'Mumbai', 'Bengaluru', 'Singapore', 'Toronto', 'Sydney'];
      const countries = ['United States', 'United States', 'United Kingdom', 'Germany', 'Japan', 'India', 'India', 'Singapore', 'Canada', 'Australia'];
      const statuses = ['Active', 'Verified', 'Contacted', 'Pending', 'Qualified'];
      for (let i = 0; i < targetRowCount; i++) {
        const cIdx = i % cities.length;
        const phone = `+1 (555) ${String(100 + ((i * 37) % 900))}-${String(1000 + ((i * 73) % 9000))}`;
        const email = `contact${i + 1}@domain${(i % 5) + 1}.com`;
        rows.push([phone, email, cities[cIdx], countries[cIdx], statuses[i % statuses.length]]);
      }
    } else if (lower.includes('sales') || lower.includes('revenue') || lower.includes('unit') || lower.includes('order')) {
      newHeaders.push('Units Sold', 'Unit Price ($)', 'Total Revenue ($)', 'Target ($)', 'Achievement (%)');
      explanation = 'Commercial sales performance metrics';
      for (let i = 0; i < targetRowCount; i++) {
        const units = 10 + ((i * 29) % 250);
        const price = parseFloat((15 + ((i * 17) % 85)).toFixed(2));
        const rev = parseFloat((units * price).toFixed(2));
        const target = parseFloat((rev * (0.8 + ((i * 7) % 40) / 100)).toFixed(2));
        const ach = parseFloat(((rev / target) * 100).toFixed(1));
        rows.push([units, price, rev, target, ach]);
      }
    } else {
      // Default smart financial / calculated columns
      const pctMatch = instructions.match(/(\d+(?:\.\d+)?)\s*%/);
      const customPct = pctMatch ? parseFloat(pctMatch[1]) : 10;
      newHeaders.push(`Bonus (${customPct}%)`, 'Annual Metric ($)', 'Performance Rating');
      explanation = `Calculated performance bonus (${customPct}%), annualized metric, and rating`;
      for (let i = 0; i < targetRowCount; i++) {
        const bonus = parseFloat((3000 * (customPct / 100) * (0.85 + ((i * 7) % 31) / 100)).toFixed(2));
        const annual = parseFloat((bonus * 12).toFixed(2));
        const rating = ['Exceeds Expectations', 'Outstanding', 'Meets Expectations', 'Top Performer'][i % 4];
        rows.push([bonus, annual, rating]);
      }
    }

    return {
      newHeaders,
      rows,
      explanation,
    };
  }

  private async queryLlm(
    instructions: string,
    baseUrl: string,
    apiKey: string,
    model: string,
  ): Promise<UniversalExcelPlan | null> {
    let cleanUrl = baseUrl.replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/chat/completions')) {
      if (!cleanUrl.endsWith('/v1')) {
        cleanUrl = `${cleanUrl}/v1/chat/completions`;
      } else {
        cleanUrl = `${cleanUrl}/chat/completions`;
      }
    }

    // Extract desired row count from instructions
    const countMatch = instructions.match(/(\d+)\s*(?:rows?|employees?|records?|items?|entries?|products?|students?|transactions?|coins?)/i);
    const requestedRowCount = countMatch ? parseInt(countMatch[1], 10) : 50;

    const systemPrompt = `You are an Autonomous Excel Architect AI. Given any user prompt, design a complete, professional, highly relevant Excel workbook.
Return strictly a valid JSON object without any Markdown formatting or code fences.

JSON Schema:
{
  "fileName": "descriptive_name.xlsx",
  "domainName": "Name of the Domain/Topic",
  "mainSheetName": "SingleWordSheetName",
  "headers": ["Col 1", "Col 2", "Col 3", "CategoryCol", "NumericCol1", "NumericCol2"],
  "sampleRows": [
    ["Val 1", "Val 2", "Val 3", "Category A", 120.50, 45],
    ["Val 4", "Val 5", "Val 6", "Category B", 85.00, 30]
  ],
  "summarySheetName": "SummaryAnalytics",
  "categories": ["Category A", "Category B", "Category C"],
  "categoryColIndex": 3,
  "numericColIndex": 4,
  "chartTitle": "Descriptive Chart Title",
  "chartType": "ColumnClustered"
}

Rules:
1. "headers" must be 5 to 8 realistic, specific columns matching the user's prompt topic.
2. "sampleRows" must contain 15 to 30 creative, non-trivial, authentic sample data rows.
3. "categoryColIndex" is the 0-based index of the column representing the primary grouping category.
4. "numericColIndex" is the 0-based index of the column representing the primary number (e.g. price, salary, revenue, grade, score).
5. "categories" must be 4 to 8 unique category values found in sampleRows.
6. The JSON must be valid and directly parsable.`;

    const userPrompt = `User Prompt: "${instructions}"
Target Total Rows Needed: ${requestedRowCount}

Design the complete workbook schema and sample rows now.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout with fallback

    try {
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      // Clean out markdown code blocks if the model wrapped them
      const cleanedJson = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleanedJson);
      const tokensConsumed = json?.usage?.total_tokens || 1450;

      const plan = this.expandPlanToTargetRows(parsed, requestedRowCount);
      plan.tokensConsumed = tokensConsumed;
      return plan;
    } finally {
      clearTimeout(timeout);
    }
  }

  private expandPlanToTargetRows(rawAiPlan: any, targetRowCount: number): UniversalExcelPlan {
    const {
      fileName = 'data_export.xlsx',
      domainName = 'Custom Dataset',
      mainSheetName = 'DataSet',
      headers = ['ID', 'Item', 'Category', 'Value'],
      sampleRows = [],
      summarySheetName = 'AnalyticsSummary',
      categories = ['General'],
      categoryColIndex = 2,
      numericColIndex = 3,
      chartTitle = 'Summary Overview',
      chartType = 'ColumnClustered',
    } = rawAiPlan;

    const rows: (string | number)[][] = [];
    const sourceRows: (string | number)[][] = sampleRows.length > 0 ? sampleRows : [
      ['1', 'Sample Item 1', 'General', 100],
      ['2', 'Sample Item 2', 'General', 200],
    ];

    // If target is small, use sample rows directly
    if (targetRowCount <= sourceRows.length) {
      rows.push(...sourceRows.slice(0, targetRowCount));
    } else {
      // Expand to exact target row count by varying the AI's authentic sample records
      for (let i = 0; i < targetRowCount; i++) {
        const template = sourceRows[i % sourceRows.length];
        const newRow: (string | number)[] = template.map((val: string | number, colIdx: number) => {
          // If first column is ID
          if (colIdx === 0 && (typeof val === 'string' || typeof val === 'number')) {
            const prefixMatch = String(val).match(/^([A-Za-z_-]+)/);
            const prefix = prefixMatch ? prefixMatch[1] : 'REC-';
            return `${prefix}${String(i + 1).padStart(4, '0')}`;
          }

          // If numeric column, add variation (+/- 20%)
          if (typeof val === 'number') {
            const factor = 0.85 + ((i * 17) % 31) / 100;
            return parseFloat((val * factor).toFixed(2));
          }

          // If string, keep or append cycle number if past original
          if (typeof val === 'string') {
            if (colIdx === categoryColIndex) return val; // preserve category exact
            if (i >= sourceRows.length && colIdx === 1) {
              return `${val} #${Math.floor(i / sourceRows.length) + 1}`;
            }
            return val;
          }

          return val;
        });
        rows.push(newRow);
      }
    }

    const catColLetter = this.colIdxToLetter(categoryColIndex);
    const numColLetter = this.colIdxToLetter(numericColIndex);

    const summaryHeaders = ['Category', 'Record Count', 'Total ($)', 'Average ($)'];
    const summaryRows: (string | number)[][] = [];

    const effectiveCategories = categories.length > 0 ? categories : ['General'];
    for (const cat of effectiveCategories) {
      summaryRows.push([
        cat,
        `=COUNTIF(${mainSheetName}!${catColLetter}2:${catColLetter}${rows.length + 1}, "${cat}")`,
        `=SUMIF(${mainSheetName}!${catColLetter}2:${catColLetter}${rows.length + 1}, "${cat}", ${mainSheetName}!${numColLetter}2:${numColLetter}${rows.length + 1})`,
        `=AVERAGEIF(${mainSheetName}!${catColLetter}2:${catColLetter}${rows.length + 1}, "${cat}", ${mainSheetName}!${numColLetter}2:${numColLetter}${rows.length + 1})`,
      ]);
    }

    return {
      fileName: fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`,
      domainName,
      mainSheetName: mainSheetName.replace(/[^a-zA-Z0-9]/g, '') || 'DataSet',
      headers,
      rows,
      summarySheetName: summarySheetName.replace(/[^a-zA-Z0-9]/g, '') || 'Summary',
      summaryHeaders,
      summaryRows,
      categories: effectiveCategories,
      categoryColumnLetter: catColLetter,
      numericColumnLetter: numColLetter,
      chartTitle,
      chartType,
    };
  }

  private colIdxToLetter(idx: number): string {
    let letter = '';
    let temp = idx + 1;
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - mod) / 26);
    }
    return letter || 'A';
  }
}
