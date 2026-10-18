import { SettingStore } from '../../../store/setting';
import { logger } from '../../../logger';
import { UniversalExcelPlan, UniversalDatasetPlanner } from './universalGenerator';

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
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s fast timeout with immediate fallback

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
