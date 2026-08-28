/**
 
 */
// Polyfill Electron IPC and Zustand Bridge when running in a standard web browser on the local network

if (typeof window !== 'undefined' && !window.electron) {
  console.log('[webBridge] Initializing Web Network Bridge for remote browser access...');

  // Use current host for API requests (supports IP access like http://192.168.x.x:5173)
  const isViteDev = window.location.port === '5173';
  const apiBase = isViteDev ? '' : `http://${window.location.hostname}:5174`;

  // Retrieve authentication token from URL parameter, localStorage, or injected global
  const searchParams = new URLSearchParams(window.location.search);
  const paramToken = searchParams.get('token');
  if (paramToken) {
    try {
      localStorage.setItem('orbit_bridge_token', paramToken);
    } catch {}
  }
  const bridgeToken =
    paramToken ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('orbit_bridge_token')
      : null) ||
    (window as any).__ORBIT_BRIDGE_TOKEN__ ||
    '';

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (bridgeToken) {
      headers['x-orbit-token'] = bridgeToken;
    }
    return headers;
  };

  let eventSource: EventSource | null = null;
  const stateListeners = new Set<(state: any) => void>();
  const settingListeners = new Set<(setting: any) => void>();

  function initEventStream() {
    if (eventSource) return;

    try {
      const sseUrl = `${apiBase}/api/events${
        bridgeToken ? `?token=${encodeURIComponent(bridgeToken)}` : ''
      }`;
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          stateListeners.forEach((listener) => listener(state));
        } catch (e) {
          console.warn('[webBridge] Failed to parse state event:', e);
        }
      };

      eventSource.addEventListener('setting-updated', (event: any) => {
        try {
          const setting = JSON.parse(event.data);
          settingListeners.forEach((listener) => listener(setting));
        } catch (e) {
          console.warn('[webBridge] Failed to parse setting event:', e);
        }
      });

      eventSource.onerror = (err) => {
        console.warn('[webBridge] EventSource disconnected, retrying...', err);
      };
    } catch (err) {
      console.error('[webBridge] Failed to initialize EventSource:', err);
    }
  }

  const invokeRemote = async (channel: string, ...args: unknown[]) => {
    try {
      const response = await fetch(`${apiBase}/api/ipc`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ channel, args }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error(
            '[webBridge] Authentication failed (401). Please supply the token via URL parameter (?token=...) or localStorage.setItem("orbit_bridge_token", "...")',
          );
        }
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.error) {
        throw new Error(json.error);
      }
      return json.data;
    } catch (err) {
      console.error(`[webBridge] Error calling remote IPC "${channel}":`, err);
      throw err;
    }
  };

  // Provide mock Electron API
  window.electron = {
    ipcRenderer: {
      invoke: invokeRemote,
      sendMessage: (channel: string, ...args: unknown[]) => {
        invokeRemote(channel, ...args).catch(() => {});
      },
      on: (_channel: string, _func: (...args: unknown[]) => void) => {
        return () => {};
      },
      once: (_channel: string, _func: (...args: unknown[]) => void) => {},
    },
    bridge: {
      getToken: async () => bridgeToken,
    },
    utio: {
      shareReport: (params: any) => invokeRemote('utio:shareReport', params),
    },
    setting: {
      getSetting: () => invokeRemote('setting:get'),
      clearSetting: () => invokeRemote('setting:clear'),
      updateSetting: (setting: any) => invokeRemote('setting:update', setting),
      importPresetFromText: (yaml: string) => invokeRemote('setting:importPresetFromText', yaml),
      importPresetFromUrl: (url: string, autoUpdate: boolean) =>
        invokeRemote('setting:importPresetFromUrl', url, autoUpdate),
      updatePresetFromRemote: () => invokeRemote('setting:updatePresetFromRemote'),
      resetPreset: () => invokeRemote('setting:resetPreset'),
      onUpdate: (callback: (setting: any) => void) => {
        initEventStream();
        settingListeners.add(callback);
      },
    },
  } as any;

  // Provide Zustand bridge for remote browser
  window.zustandBridge = {
    getState: async () => {
      try {
        const res = await fetch(`${apiBase}/api/state`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        console.warn('[webBridge] Failed to fetch initial state:', err);
        return {};
      }
    },
    subscribe: (callback: (state: any) => void) => {
      initEventStream();
      stateListeners.add(callback);
      return () => {
        stateListeners.delete(callback);
      };
    },
  };

  // Default browser platform
  window.platform = (navigator.userAgent.includes('Mac')
    ? 'darwin'
    : navigator.userAgent.includes('Win')
      ? 'win32'
      : 'linux') as NodeJS.Platform;

  console.log('[webBridge] Web Network Bridge successfully activated for IP/browser access!');
}

export {};

