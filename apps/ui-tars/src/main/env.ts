/**
 
 */
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const mode = process.env.NODE_ENV;
export const isProd = mode === 'production';
export const isDev = mode === 'development';
export const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
export const port = process.env.PORT || 1212;
export const startMinimized = process.env.START_MINIMIZED;
export const rendererUrl = process.env.ELECTRON_RENDERER_URL;
export const isE2eTest = process.env.CI === 'e2e';

export const vlmProvider =
  process.env.VLM_PROVIDER ||
  (process.env.OPENAI_API_KEY ? 'OpenAI' : undefined);
export const vlmBaseUrl =
  process.env.VLM_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  (process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1' : undefined);
export const vlmApiKey =
  process.env.VLM_API_KEY || process.env.OPENAI_API_KEY;
export const vlmModelName =
  process.env.VLM_MODEL_NAME ||
  process.env.OPENAI_MODEL_NAME ||
  (process.env.OPENAI_API_KEY ? 'gpt-4o' : undefined);

const { platform } = process;
export const isMacOS = platform === 'darwin';

export const isWindows = platform === 'win32';

export const isLinux = platform === 'linux';

/**
 * @see https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information
 * Windows 11 buildNumber starts from 22000.
 */
const detectingWindows11 = () => {
  if (!isWindows) return false;

  const release = os.release();
  const majorVersion = Number.parseInt(release.split('.')[0]);
  const buildNumber = Number.parseInt(release.split('.')[2]);

  return majorVersion === 10 && buildNumber >= 22000;
};

export const isWindows11 = detectingWindows11();
