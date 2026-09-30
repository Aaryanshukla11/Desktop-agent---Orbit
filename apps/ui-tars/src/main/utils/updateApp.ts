import { UpdateInfo } from 'builder-util-runtime';
import { app, dialog, BrowserWindow } from 'electron';
import { logger } from '@main/logger';
import {
  AppUpdater as ElectronAppUpdater,
  autoUpdater,
} from 'electron-updater';
import { CustomGitHubProvider } from '@main/electron-updater/GitHubProvider';
import { REPO_OWNER, REPO_NAME } from '@main/shared/constants';

export class AppUpdater {
  autoUpdater: ElectronAppUpdater = autoUpdater;

  checkReleaseName(releaseInfo: UpdateInfo): boolean {
    const releaseName = releaseInfo?.files?.[0]?.url;

    return Boolean(
      releaseName && /ui[-.\s]?tars/i.test(releaseName.toLowerCase()),
    );
  }

  constructor(mainWindow: BrowserWindow) {
    autoUpdater.logger = logger;
    autoUpdater.autoDownload = false;

    autoUpdater.setFeedURL({
      // hack for custom provider
      provider: 'custom' as 'github',
      owner: REPO_OWNER,
      repo: REPO_NAME,
      // @ts-expect-error hack for custom provider
      updateProvider: CustomGitHubProvider,
    });

    autoUpdater.on('error', (error) => {
      logger.error('Update_Error', error);
      mainWindow.webContents.send('main:error', error);
    });

    autoUpdater.on('update-available', (releaseInfo: UpdateInfo) => {
      logger.info('new version', releaseInfo);

      if (this.checkReleaseName(releaseInfo)) {
        mainWindow.webContents.send('app-update-available', releaseInfo);
        autoUpdater.downloadUpdate();
      } else {
        logger.info('Cannot match');
      }
    });

    // Listen for download progress (optional)
    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
      logger.info(logMessage);
    });

    // Listen for update download completion
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded');
      dialog
        .showMessageBox({
          type: 'info',
          title: 'Update Ready',
          message: 'New version has been downloaded. Install now?',
          buttons: ['Install Now', 'Install Later'],
          detail: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${info.version}`,
        })
        .then((response) => {
          if (response.response === 0) {
            // User chose "Install Now"
            autoUpdater.quitAndInstall(); // Quit and install update
          }
        });
    });

    this.autoUpdater = autoUpdater;
    // Standalone Orbit Beta: Remote auto-updater disabled to prevent external binary overwrites.
    logger.info('[Orbit Security] Automatic remote updates disabled for standalone security.');
  }

  async checkForUpdatesDetail(): Promise<{
    currentVersion: string;
    updateInfo: UpdateInfo | null;
  }> {
    return {
      currentVersion: app.getVersion(),
      updateInfo: null,
    };
  }

  // Function to manually check for updates (local check only)
  checkForUpdates() {
    dialog.showMessageBox({
      type: 'info',
      title: 'Orbit Beta',
      message: `You are running Orbit Beta v${app.getVersion()}.`,
      detail: 'This is a standalone, sovereign desktop installation. External auto-updates are disabled.',
    });
  }
}

