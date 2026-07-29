/**
 
 */
import { z } from 'zod';

import { SearchEngineForSettings, VLMProviderV2, Operator } from './types';

const PresetSourceSchema = z.object({
  type: z.enum(['local', 'remote']),
  url: z.string().url().optional(),
  autoUpdate: z.boolean().optional(),
  lastUpdated: z.number().optional(),
});

export const PresetSchema = z.object({
  // Local VLM Settings
  vlmProvider: z.nativeEnum(VLMProviderV2).optional(),
  vlmBaseUrl: z.string().url(),
  vlmApiKey: z.string().min(1),
  vlmModelName: z.string().min(1),
  useResponsesApi: z.boolean().optional(),

  // Chat Settings
  operator: z.nativeEnum(Operator),
  language: z.enum(['zh', 'en']).optional(),
  screenshotScale: z.number().min(0.1).max(1).optional(),
  maxLoopCount: z.number().min(25).max(200).optional(),
  loopIntervalInMs: z.number().min(0).max(3000).optional(),
  searchEngineForBrowser: z.nativeEnum(SearchEngineForSettings).optional(),

  // Report Settings
  reportStorageBaseUrl: z.string().url().optional(),
  utioBaseUrl: z.string().url().optional(),
  presetSource: PresetSourceSchema.optional(),
});

export type PresetSource = z.infer<typeof PresetSourceSchema>;
export type LocalStore = z.infer<typeof PresetSchema>;

export const validatePreset = (data: unknown): LocalStore => {
  return PresetSchema.parse(data);
};

export const SettingUpdateSchema = z
  .object({
    // Local VLM Settings
    vlmProvider: z
      .union([z.nativeEnum(VLMProviderV2), z.literal('')])
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
    vlmBaseUrl: z.string().optional(),
    vlmApiKey: z.string().optional(),
    vlmModelName: z.string().optional(),
    useResponsesApi: z.boolean().optional(),

    // Chat Settings
    operator: z.nativeEnum(Operator).optional(),
    language: z.enum(['zh', 'en']).optional(),
    screenshotScale: z.number().min(0.1).max(1).optional(),
    maxLoopCount: z.number().min(25).max(200).optional(),
    loopIntervalInMs: z.number().min(0).max(3000).optional(),
    searchEngineForBrowser: z.nativeEnum(SearchEngineForSettings).optional(),

    // Report Settings
    reportStorageBaseUrl: z.string().optional(),
    utioBaseUrl: z.string().optional(),
    presetSource: PresetSourceSchema.optional(),
  })
  .strict();

export const validateSettingUpdate = (data: unknown): Partial<LocalStore> => {
  return SettingUpdateSchema.parse(data);
};

export const MASKED_SECRET = '••••••••';

export function isMaskedSecret(val: unknown): boolean {
  if (typeof val !== 'string' || val.length === 0) return false;
  return (
    val === MASKED_SECRET ||
    val === '********' ||
    /^[•*]+$/.test(val)
  );
}

export function maskSettings<T extends Record<string, any>>(settings: T): T {
  if (!settings || typeof settings !== 'object') return settings;
  const masked = { ...settings } as any;
  if (
    typeof masked.vlmApiKey === 'string' &&
    masked.vlmApiKey.length > 0 &&
    !isMaskedSecret(masked.vlmApiKey)
  ) {
    masked.vlmApiKey = MASKED_SECRET;
  }
  return masked;
}

