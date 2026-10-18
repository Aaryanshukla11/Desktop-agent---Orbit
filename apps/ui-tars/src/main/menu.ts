/**
 
 */
import { BrowserWindow, Menu, MenuItemConstructorOptions, app, clipboard, shell } from 'electron';

import { isDev } from '@main/env';

import { exportLogs, revealLogDir, clearLogs } from './logger';
import type { AppUpdater } from '@main/utils/updateApp';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  browserWindow: BrowserWindow;
  appUpdater: AppUpdater;

  constructor(browserWindow: BrowserWindow, appUpdater: AppUpdater) {
    this.browserWindow = browserWindow;
    this.appUpdater = appUpdater;
  }

  buildMenu(): Menu {
    this.setupContextMenu();

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupContextMenu(): void {
    this.browserWindow.webContents.on('context-menu', (_, props) => {
      const { isEditable, selectionText, editFlags, x, y, linkURL } = props;
      const menuItems: MenuItemConstructorOptions[] = [];

      if (linkURL) {
        menuItems.push(
          {
            label: 'Open Link in Browser',
            click: () => {
              shell.openExternal(linkURL);
            },
          },
          {
            label: 'Copy Link Address',
            click: () => {
              clipboard.writeText(linkURL);
            },
          },
          { type: 'separator' },
        );
      }

      if (isEditable) {
        menuItems.push(
          { label: 'Undo', role: 'undo', enabled: editFlags.canUndo },
          { label: 'Redo', role: 'redo', enabled: editFlags.canRedo },
          { type: 'separator' },
          { label: 'Cut', role: 'cut', enabled: editFlags.canCut },
          { label: 'Copy', role: 'copy', enabled: editFlags.canCopy },
          { label: 'Paste', role: 'paste', enabled: editFlags.canPaste },
          {
            label: 'Paste and Match Style',
            role: 'pasteAndMatchStyle',
            enabled: editFlags.canPaste,
          },
          { label: 'Delete', role: 'delete', enabled: editFlags.canDelete },
          { type: 'separator' },
          {
            label: 'Select All',
            role: 'selectAll',
            enabled: editFlags.canSelectAll,
          },
        );
      } else if (selectionText && selectionText.trim().length > 0) {
        menuItems.push(
          { label: 'Copy', role: 'copy' },
          { type: 'separator' },
          { label: 'Select All', role: 'selectAll' },
        );
      } else {
        menuItems.push(
          { label: 'Select All', role: 'selectAll' },
        );
      }

      if (isDev) {
        menuItems.push(
          { type: 'separator' },
          {
            label: 'Inspect Element',
            click: () => {
              this.browserWindow.webContents.inspectElement(x, y);
            },
          },
        );
      }

      if (menuItems.length > 0) {
        Menu.buildFromTemplate(menuItems).popup({ window: this.browserWindow });
      }
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'Orbit Beta',
      submenu: [
        {
          label: 'About Orbit Beta',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide Orbit Beta',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', role: 'undo', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', role: 'redo', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', role: 'cut', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', role: 'copy', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', role: 'paste', selector: 'paste:' },
        {
          label: 'Paste and Match Style',
          accelerator: 'Shift+Command+V',
          role: 'pasteAndMatchStyle',
        },
        { label: 'Delete', role: 'delete' },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          role: 'selectAll',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.browserWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.browserWindow.setFullScreen(
              !this.browserWindow.isFullScreen(),
            );
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.browserWindow.webContents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.browserWindow.setFullScreen(
              !this.browserWindow.isFullScreen(),
            );
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            this.appUpdater.checkForUpdates();
          },
        },
        { type: 'separator' },
        {
          label: 'Logs',
          submenu: [
            {
              label: 'Export Current Log',
              click: async () => {
                await exportLogs();
              },
            },
            {
              label: 'Open Log Directory',
              click: async () => {
                await revealLogDir();
              },
            },
            {
              label: 'Clear Logs',
              click: () => {
                clearLogs();
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          click: () => {
            this.browserWindow.webContents.toggleDevTools();
          },
        },
      ],
    };

    const subMenuView = isDev ? subMenuViewDev : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }

  buildDefaultTemplate() {
    const templateDefault: MenuItemConstructorOptions[] = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Open',
            accelerator: 'Ctrl+O',
          },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: () => {
              this.browserWindow.close();
            },
          },
        ],
      },
      {
        label: '&Edit',
        submenu: [
          { label: '&Undo', accelerator: 'Ctrl+Z', role: 'undo' },
          { label: '&Redo', accelerator: 'Ctrl+Y', role: 'redo' },
          { type: 'separator' },
          { label: 'Cu&t', accelerator: 'Ctrl+X', role: 'cut' },
          { label: '&Copy', accelerator: 'Ctrl+C', role: 'copy' },
          { label: '&Paste', accelerator: 'Ctrl+V', role: 'paste' },
          {
            label: 'Paste and &Match Style',
            accelerator: 'Ctrl+Shift+V',
            role: 'pasteAndMatchStyle',
          },
          { label: '&Delete', role: 'delete' },
          { type: 'separator' },
          { label: 'Select &All', accelerator: 'Ctrl+A', role: 'selectAll' },
        ],
      },
      {
        label: '&View',
        submenu: isDev
          ? [
              {
                label: '&Reload',
                accelerator: 'Ctrl+R',
                click: () => {
                  this.browserWindow.webContents.reload();
                },
              },
              {
                label: 'Toggle &Full Screen',
                accelerator: 'F11',
                click: () => {
                  this.browserWindow.setFullScreen(
                    !this.browserWindow.isFullScreen(),
                  );
                },
              },
            ]
          : [
              {
                label: 'Toggle &Full Screen',
                accelerator: 'F11',
                click: () => {
                  this.browserWindow.setFullScreen(
                    !this.browserWindow.isFullScreen(),
                  );
                },
              },
            ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Check for Updates',
            click: () => {
              this.appUpdater.checkForUpdates();
            },
          },
          {
            label: 'Logs',
            submenu: [
              {
                label: 'Export Current Log',
                click: async () => {
                  await exportLogs();
                },
              },
              {
                label: 'Open Log Directory',
                click: async () => {
                  await revealLogDir();
                },
              },
              {
                label: 'Clear Logs',
                click: () => {
                  clearLogs();
                },
              },
            ],
          },
          {
            label: 'Toggle &Developer Tools',
            accelerator: 'Alt+Ctrl+I',
            click: () => {
              this.browserWindow.webContents.toggleDevTools();
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
