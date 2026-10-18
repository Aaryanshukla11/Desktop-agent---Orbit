import { ipcMain } from 'electron';
import { SettingStore } from '../store/setting';
import { logger } from '../logger';
import {
  LocalStore,
  validateSettingUpdate,
  isMaskedSecret,
} from '@main/store/validate';
import { isTrustedRendererFrame } from '../utils/security';

function assertTrustedFrame(senderFrame: Electron.WebFrameMain | null | undefined, channel: string) {
  if (!isTrustedRendererFrame(senderFrame)) {
    logger.warn(`[settings] Unauthorized IPC call to ${channel} from frame: ${senderFrame?.url}`);
    throw new Error('Unauthorized IPC sender');
  }
}

export function registerSettingsHandlers() {
  /**
   * Get setting
   */
  ipcMain.handle('setting:get', (event) => {
    assertTrustedFrame(event.senderFrame, 'setting:get');
    return SettingStore.getStore();
  });

  /**
   * Clear setting
   */
  ipcMain.handle('setting:clear', (event) => {
    assertTrustedFrame(event.senderFrame, 'setting:clear');
    SettingStore.clear();
  });

  /**
   * Reset setting preset
   */
  ipcMain.handle('setting:resetPreset', (event) => {
    assertTrustedFrame(event.senderFrame, 'setting:resetPreset');
    SettingStore.getInstance().delete('presetSource');
  });

  /**
   * Update setting
   */
  ipcMain.handle('setting:update', async (event, settings: unknown) => {
    assertTrustedFrame(event.senderFrame, 'setting:update');
    const validatedUpdate = validateSettingUpdate(settings);
    const current = SettingStore.getStore();
    if (
      validatedUpdate.vlmApiKey !== undefined &&
      isMaskedSecret(validatedUpdate.vlmApiKey)
    ) {
      validatedUpdate.vlmApiKey = current.vlmApiKey;
    }
    const merged = { ...current, ...validatedUpdate };
    SettingStore.setStore(merged as LocalStore);
  });

  /**
   * Import setting preset from text
   */
  ipcMain.handle('setting:importPresetFromText', async (event, yamlContent) => {
    assertTrustedFrame(event.senderFrame, 'setting:importPresetFromText');
    try {
      const newSettings = await SettingStore.importPresetFromText(yamlContent);
      SettingStore.setStore(newSettings);
    } catch (error) {
      logger.error('Failed to import preset:', error);
      throw error;
    }
  });

  /**
   * Import setting preset from url
   */
  ipcMain.handle('setting:importPresetFromUrl', async (event, url, autoUpdate) => {
    assertTrustedFrame(event.senderFrame, 'setting:importPresetFromUrl');
    try {
      const newSettings = await SettingStore.fetchPresetFromUrl(url);
      SettingStore.setStore({
        ...newSettings,
        presetSource: {
          type: 'remote',
          url: url,
          autoUpdate: autoUpdate,
          lastUpdated: Date.now(),
        },
      });
    } catch (error) {
      logger.error('Failed to import preset from URL:', error);
      throw error;
    }
  });

  /**
   * Update setting preset from url
   */
  ipcMain.handle('setting:updatePresetFromRemote', async (event) => {
    assertTrustedFrame(event.senderFrame, 'setting:updatePresetFromRemote');
    const settings = SettingStore.getStore();
    if (settings.presetSource?.type === 'remote' && settings.presetSource.url) {
      const newSettings = await SettingStore.fetchPresetFromUrl(
        settings.presetSource.url,
      );
      SettingStore.setStore({
        ...newSettings,
        presetSource: {
          type: 'remote',
          url: settings.presetSource.url,
          autoUpdate: settings.presetSource.autoUpdate,
          lastUpdated: Date.now(),
        },
      });
    } else {
      throw new Error('No remote preset configured');
    }
  });
}

