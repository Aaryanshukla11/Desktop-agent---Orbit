/**
 
 */
import path from 'node:path';
import { AppUpdater } from '@main/utils/updateApp';

import { BrowserWindow, app, shell, nativeImage } from 'electron';

import * as env from '@main/env';
import { logger } from '@main/logger';
import MenuBuilder from '@main/menu';

import icon from '@resources/icon.png?asset';

let appUpdater: AppUpdater;

export function createWindow({
  width,
  height,
  showInBackground,

  routerPath = '',
  ...extraConfigs
}: {
  routerPath?: string;
  showInBackground?: boolean;
  width: number;
  height: number;
} & Electron.BrowserWindowConstructorOptions): BrowserWindow {
  let baseWindowConfig: Electron.BrowserWindowConstructorOptions = {
    title: 'Orbit Beta',
    show: false,
    width,
    height,
    resizable: true,
    maximizable: true,
    minimizable: true,
    fullscreenable: true,
    movable: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  switch (true) {
    case env.isMacOS: {
      baseWindowConfig = {
        ...baseWindowConfig,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: {
          x: 9,
          y: 9,
        },
        visualEffectState: 'active',
        vibrancy: 'under-window',
        transparent: true,
      };
      break;
    }
    case env.isWindows: {
      const pathsToTry = [
        path.join(app.getAppPath(), 'resources/icon.ico'),
        path.join(app.getAppPath(), 'resources/icon.png'),
        path.join(__dirname, '../../resources/icon.ico'),
        path.join(__dirname, '../../resources/icon.png'),
      ];
      let winIcon = nativeImage.createEmpty();
      for (const p of pathsToTry) {
        const candidate = nativeImage.createFromPath(p);
        if (!candidate.isEmpty()) {
          winIcon = candidate;
          break;
        }
      }
      baseWindowConfig = {
        ...baseWindowConfig,
        icon: !winIcon.isEmpty() ? winIcon : icon,
        autoHideMenuBar: true,
        frame: true,
        resizable: true,
        maximizable: true,
      };
      break;
    }
    default: {
      baseWindowConfig.icon = icon;
    }
  }

  const browserWindowConfig = {
    ...baseWindowConfig,
    ...extraConfigs,
  };
  logger.info(
    '[createWindow]: routerPath: ',
    routerPath,
    'config: ',
    browserWindowConfig,
  );
  const browserWindow = new BrowserWindow(browserWindowConfig);
  browserWindow.setResizable(true);
  browserWindow.setMaximizable(true);

  if (env.isWindows) {
    const pathsToTry = [
      path.join(app.getAppPath(), 'resources/icon.ico'),
      path.join(app.getAppPath(), 'resources/icon.png'),
      path.join(__dirname, '../../resources/icon.ico'),
      path.join(__dirname, '../../resources/icon.png'),
    ];
    for (const p of pathsToTry) {
      const candidate = nativeImage.createFromPath(p);
      if (!candidate.isEmpty()) {
        browserWindow.setIcon(candidate);
        break;
      }
    }
  }

  // Prevent unauthorized in-window navigation
  browserWindow.webContents.on('will-navigate', (event, targetUrl) => {
    try {
      const parsed = new URL(targetUrl);
      if (
        !app.isPackaged &&
        env.rendererUrl &&
        targetUrl.startsWith(env.rendererUrl)
      ) {
        return; // Allow local dev server
      }
      if (parsed.protocol === 'file:') {
        return; // Allow packaged local app file navigation
      }
      logger.warn('[createWindow] Blocked unauthorized window navigation:', targetUrl);
      event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  console.log('renderer url', env.rendererUrl);
  if (!app.isPackaged && env.rendererUrl) {
    const base = env.rendererUrl.replace(/\/+$/, '');
    const cleanPath = routerPath.startsWith('/') ? routerPath : `/${routerPath}`;
    browserWindow.loadURL(`${base}${cleanPath}`);
  } else {
    browserWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: routerPath,
    });
  }

  browserWindow.on('ready-to-show', () => {
    const shouldShowWindow =
      !app.getLoginItemSettings().wasOpenedAsHidden && !showInBackground;
    if (shouldShowWindow) browserWindow.show();
  });

  if (!appUpdater) {
    appUpdater = new AppUpdater(browserWindow);
  }

  const menuBuilder = new MenuBuilder(browserWindow, appUpdater);
  menuBuilder.buildMenu();

  browserWindow.webContents.setWindowOpenHandler((edata) => {
    try {
      const parsed = new URL(edata.url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(edata.url);
      } else {
        logger.warn(
          '[createWindow] Blocked non-http(s) window open request:',
          edata.url,
        );
      }
    } catch (e) {
      logger.warn('[createWindow] Invalid URL in window open request:', edata.url);
    }
    return { action: 'deny' };
  });

  return browserWindow;
}

export { appUpdater };
