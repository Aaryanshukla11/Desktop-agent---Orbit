/*

 */
import { createClient } from '@ui-tars/electron-ipc/renderer';
import type { Router } from '@main/ipcRoutes';

export const api = createClient<Router>({
  ipcInvoke: window.electron.ipcRenderer.invoke,
});
