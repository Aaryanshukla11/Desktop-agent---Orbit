/**
 
 */
import { OpenAI } from 'openai';
import { initIpc } from '@ui-tars/electron-ipc/main';
import { logger } from '../logger';

const t = initIpc.create();

function normalizeBaseUrl(url: string): string {
  if (!url) return 'https://api.openai.com/v1';
  let cleaned = url.trim();
  if (cleaned.includes('platform.openai.com')) {
    cleaned = cleaned.replace(/https?:\/\/platform\.openai\.com\/?(v1)?\/?/i, 'https://api.openai.com/v1');
  }
  if (cleaned === 'https://api.openai.com' || cleaned === 'https://api.openai.com/') {
    cleaned = 'https://api.openai.com/v1';
  }
  return cleaned;
}

export const settingRoute = t.router({
  checkVLMResponseApiSupport: t.procedure
    .input<{
      baseUrl: string;
      apiKey: string;
      modelName: string;
    }>()
    .handle(async ({ input }) => {
      try {
        const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl);
        const openai = new OpenAI({
          apiKey: input.apiKey,
          baseURL: normalizedBaseUrl,
        });
        const result = await openai.responses.create({
          model: input.modelName,
          input: 'return 1+1=?',
          stream: false,
        });
        console.log('result', result);
        return Boolean(result?.id || result?.previous_response_id);
      } catch (e) {
        logger.warn('[checkVLMResponseApiSupport] failed:', e);
        return false;
      }
    }),
  checkModelAvailability: t.procedure
    .input<{
      baseUrl: string;
      apiKey: string;
      modelName: string;
    }>()
    .handle(async ({ input }) => {
      try {
        const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl);
        const openai = new OpenAI({
          apiKey: input.apiKey,
          baseURL: normalizedBaseUrl,
        });
        const completion = await openai.chat.completions.create({
          model: input.modelName,
          messages: [{ role: 'user', content: 'return 1+1=?' }],
          stream: false,
        });
        console.log('result', completion);

        return Boolean(completion?.id || completion.choices[0].message.content);
      } catch (e: any) {
        logger.error('[checkModelAvailability] failed:', e);
        const errStr = e?.message || String(e);
        if (
          errStr.includes('403') &&
          (errStr.includes('html') || errStr.includes('challenge') || errStr.includes('Cloudflare'))
        ) {
          throw new Error(
            '403 Forbidden: Request was blocked. Your VLM Base URL must be "https://api.openai.com/v1" (not platform.openai.com).',
          );
        }
        if (errStr.includes('401') || errStr.includes('Incorrect API key')) {
          throw new Error('401 Unauthorized: Invalid OpenAI API key. Please check your key.');
        }
        if (errStr.includes('404')) {
          throw new Error('404 Not Found: Ensure Base URL is "https://api.openai.com/v1" and model name exists.');
        }
        throw e;
      }
    }),
});
