import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';

vi.mock('@main/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    setFeedURL: vi.fn(),
    checkForUpdatesAndNotify: vi.fn(),
    checkForUpdates: vi.fn(),
  },
  AppUpdater: vi.fn(),
}));

vi.mock('@main/utils/updateApp', () => ({
  AppUpdater: vi.fn(),
}));

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private data: any = {
        language: 'en',
        vlmProvider: 'openai',
        vlmBaseUrl: 'https://api.openai.com/v1',
        vlmApiKey: 'test-key',
        vlmModelName: 'gpt-4o',
      };
      get store() {
        return this.data;
      }
      get(key: string) {
        return this.data[key];
      }
      set(key: any, val: any) {
        if (typeof key === 'object') {
          Object.assign(this.data, key);
        } else {
          this.data[key] = val;
        }
      }
      delete(key: string) {
        delete this.data[key];
      }
      clear() {
        this.data = {};
      }
      onDidAnyChange() {}
    },
  };
});

vi.mock('electron', () => {
  const mockApp = {
    isPackaged: false,
    getVersion: vi.fn(() => '1.0.0'),
    getName: vi.fn(() => 'Orbit'),
    getPath: vi.fn(() => 'C:\\temp'),
    on: vi.fn(),
    off: vi.fn(),
    quit: vi.fn(),
  };
  return {
    app: mockApp,
    default: { app: mockApp },
    BrowserWindow: {
      getAllWindows: () => [],
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({ size: { width: 1920, height: 1080 } })),
    },
  };
});

import {
  startBridgeServer,
  stopBridgeServer,
  setBridgeToken,
} from '../bridgeServer';
import { isTrustedRendererFrame } from '../../utils/security';
import { SettingStore } from '../../store/setting';
import { app } from 'electron';

const TEST_PORT = 5198;
const TEST_TOKEN = 'test-secret-bridge-token-1234567890abcdef';

function makeRequest(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  port?: number;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string; json?: any }> {
  const port = options.port || TEST_PORT;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: options.path,
        method: options.method || 'GET',
        headers: {
          Host: `127.0.0.1:${port}`,
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let json: any = undefined;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: data,
            json,
          });
        });
      },
    );

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

describe('Bridge Server Security & Hardening', () => {
  let server: http.Server;

  beforeAll(async () => {
    setBridgeToken(TEST_TOKEN);
    server = startBridgeServer(TEST_PORT);
    // Allow small delay for socket binding
    await new Promise((resolve) => setTimeout(resolve, 150));
  });

  afterAll(async () => {
    await stopBridgeServer();
  });

  describe('1. Loopback Binding Security', () => {
    it('binds exclusively to 127.0.0.1, not 0.0.0.0', () => {
      const addr = server.address();
      expect(addr).toBeDefined();
      if (typeof addr === 'object' && addr !== null) {
        expect(addr.address).toBe('127.0.0.1');
        expect(addr.port).toBe(TEST_PORT);
      } else {
        throw new Error('Address is not an AddressInfo object');
      }
    });
  });

  describe('2. CORS and Origin Validation', () => {
    it('allows approved loopback origin http://localhost:5173', async () => {
      const res = await makeRequest({
        path: '/api/ip',
        headers: {
          Origin: 'http://localhost:5173',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('rejects unapproved external origin with 403 and sets no allow-origin', async () => {
      const res = await makeRequest({
        path: '/api/ip',
        headers: {
          Origin: 'https://malicious-website.com',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.json?.error).toContain('Origin not allowed');
    });

    it('blocks DNS rebinding attempts with disallowed Host header', async () => {
      const res = await makeRequest({
        path: '/api/ip',
        headers: {
          Host: 'attacker-domain.com:5198',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json?.error).toContain('Host header not allowed');
    });
  });

  describe('3. Token Authentication Enforcement', () => {
    it('blocks unauthenticated GET /api/state with 401', async () => {
      const res = await makeRequest({
        path: '/api/state',
      });

      expect(res.statusCode).toBe(401);
      expect(res.json?.error).toContain('Unauthorized');
    });

    it('blocks GET /api/state with invalid token with 401', async () => {
      const res = await makeRequest({
        path: '/api/state',
        headers: {
          'x-orbit-token': 'wrong-token-invalid',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json?.error).toContain('Unauthorized');
    });

    it('allows GET /api/state with valid x-orbit-token header', async () => {
      const res = await makeRequest({
        path: '/api/state',
        headers: {
          'x-orbit-token': TEST_TOKEN,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json).toBeDefined();
    });

    it('allows GET /api/state with valid Authorization: Bearer token header', async () => {
      const res = await makeRequest({
        path: '/api/state',
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json).toBeDefined();
    });

    it('blocks unauthenticated POST /api/ipc with 401', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: 'getState', args: [] }),
      });

      expect(res.statusCode).toBe(401);
      expect(res.json?.error).toContain('Unauthorized');
    });

    it('blocks unauthenticated GET /api/events with 401', async () => {
      const res = await makeRequest({
        path: '/api/events',
      });

      expect(res.statusCode).toBe(401);
      expect(res.json?.error).toContain('Unauthorized');
    });

    it('allows GET /api/events with valid query token', async () => {
      const res = await new Promise<{ statusCode: number; contentType?: string }>((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: TEST_PORT,
          path: `/api/events?token=${TEST_TOKEN}`,
          method: 'GET',
          headers: {
            Host: `127.0.0.1:${TEST_PORT}`,
          },
        });

        req.on('response', (response) => {
          resolve({
            statusCode: response.statusCode || 0,
            contentType: response.headers['content-type'],
          });
          response.destroy();
          req.destroy();
        });

        req.on('error', reject);
        req.end();
      });

      expect(res.statusCode).toBe(200);
      expect(res.contentType).toContain('text/event-stream');
    });
  });

  describe('4. IPC Channel Allowlist and Input Sanitization', () => {
    it('rejects unapproved IPC channels with 400 even when authenticated', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'unapproved:arbitraryAction',
          args: [],
        }),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json?.error).toContain('Forbidden or unapproved IPC channel');
    });

    it('rejects prototype pollution channel names with 400', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: '__proto__',
          args: [],
        }),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json?.error).toContain('Invalid IPC channel');
    });

    it('rejects non-array args with 400', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'getState',
          args: 'not-an-array',
        }),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json?.error).toContain('args must be an array');
    });

    it('allows approved getState channel when authenticated', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'getState',
          args: [],
        }),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json?.data).toBeDefined();
    });

    it('allows approved setting:get channel when authenticated', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'setting:get',
          args: [],
        }),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json?.data).toBeDefined();
    });

    it('executes diagnose:mouse safely without shell commands and rejects invalid action', async () => {
      // Invalid action
      const invalidRes = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'diagnose:mouse',
          args: ['malicious_command; rm -rf /', 100, 200],
        }),
      });

      expect(invalidRes.statusCode).toBe(400);
      expect(invalidRes.json?.error).toContain('Invalid mouse action');

      // Valid action
      const validRes = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'diagnose:mouse',
          args: ['click', 150, 250],
        }),
      });

      expect(validRes.statusCode).toBe(200);
      expect(validRes.json?.data?.success).toBe(true);
      expect(validRes.json?.data?.action).toBe('click');
      expect(validRes.json?.data?.x).toBe(150);
      expect(validRes.json?.data?.y).toBe(250);
    });

    it('rejects setting:update when payload is not an object', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'setting:update',
          args: ['not-an-object'],
        }),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json?.error).toContain('Invalid setting payload');
    });

    it('does not print the session token or secret-bearing URL in startup logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const tempServer = startBridgeServer(TEST_PORT + 10);
      try {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const loggedMessages = consoleSpy.mock.calls
          .map((call) => call.join(' '))
          .join('\n');
        expect(loggedMessages).not.toContain(TEST_TOKEN);
        expect(loggedMessages).not.toContain('Token:');
        expect(loggedMessages).toContain('Token Authentication Enforced');
      } finally {
        tempServer.close();
        consoleSpy.mockRestore();
      }
    });

    it('never reveals raw API keys or secrets in setting:get response', async () => {
      SettingStore.set('vlmApiKey', 'super-secret-api-key-12345');

      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'setting:get',
          args: [],
        }),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json?.data).toBeDefined();
      expect(res.json?.data?.vlmApiKey).toBe('••••••••');
      expect(res.json?.data?.vlmApiKey).not.toBe('super-secret-api-key-12345');
      // Store retains the real unmasked key
      expect(SettingStore.get('vlmApiKey')).toBe('super-secret-api-key-12345');
    });

    it('preserves existing credentials when masked secret is submitted in setting:update', async () => {
      SettingStore.set('vlmApiKey', 'super-secret-api-key-12345');
      SettingStore.set('language', 'en');

      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'setting:update',
          args: [
            {
              language: 'zh',
              vlmApiKey: '••••••••',
            },
          ],
        }),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json?.data?.success).toBe(true);
      expect(SettingStore.get('language')).toBe('zh');
      // Secret was preserved, NOT overwritten with '••••••••'
      expect(SettingStore.get('vlmApiKey')).toBe('super-secret-api-key-12345');
    });

    it('updates API key when a new unmasked key is provided', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'setting:update',
          args: [
            {
              vlmApiKey: 'sk-new-valid-api-key',
            },
          ],
        }),
      });

      expect(res.statusCode).toBe(200);
      expect(SettingStore.get('vlmApiKey')).toBe('sk-new-valid-api-key');
    });

    it('rejects setting updates with unexpected or dangerous fields (strict schema validation)', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'setting:update',
          args: [
            {
              language: 'en',
              unexpectedEvilProp: 'dangerous_payload',
            },
          ],
        }),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json?.error).toContain('Invalid setting update payload');
    });

    it('rejects setting updates with invalid data types', async () => {
      const res = await makeRequest({
        path: '/api/ipc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orbit-token': TEST_TOKEN,
        },
        body: JSON.stringify({
          channel: 'setting:update',
          args: [
            {
              maxLoopCount: 'not-a-number',
            },
          ],
        }),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json?.error).toContain('Invalid setting update payload');
    });
  });

  describe('Trusted sender frame validation for bridge:getToken', () => {
    it('rejects missing or null frames', () => {
      expect(isTrustedRendererFrame(null)).toBe(false);
      expect(isTrustedRendererFrame(undefined)).toBe(false);
    });

    it('rejects unauthorized external web origins', () => {
      const evilFrame = { url: 'https://evil.com/exploit.html' } as any;
      expect(isTrustedRendererFrame(evilFrame)).toBe(false);

      const localhostWrongPort = { url: 'http://localhost:9999' } as any;
      expect(isTrustedRendererFrame(localhostWrongPort)).toBe(false);
    });

    it('rejects arbitrary local file: URLs', () => {
      const untrustedFileFrame = {
        url: 'file:///C:/Users/attacker/Downloads/malicious.html',
      } as any;
      expect(isTrustedRendererFrame(untrustedFileFrame)).toBe(false);
    });

    it('allows configured development renderer URL when unpackaged', () => {
      (process.env as Record<string, string | undefined>).ELECTRON_RENDERER_URL =
        'http://localhost:5173';
      (app as any).isPackaged = false;

      const validDevFrame = {
        url: 'http://localhost:5173/#/settings',
      } as any;
      expect(isTrustedRendererFrame(validDevFrame)).toBe(true);
    });

    it('strictly requires exact bundled index.html in production / packaged mode', () => {
      (app as any).isPackaged = true;

      // Dev URL must be rejected in production
      const devFrameInProd = {
        url: 'http://localhost:5173/#/settings',
      } as any;
      expect(isTrustedRendererFrame(devFrameInProd)).toBe(false);

      // Random file URL rejected
      const randomFile = {
        url: 'file:///C:/random/index.html',
      } as any;
      expect(isTrustedRendererFrame(randomFile)).toBe(false);

      // Exact bundled index.html accepted
      const path = require('node:path');
      const { pathToFileURL } = require('node:url');
      const expectedPath = path.resolve(__dirname, '../../renderer/index.html');
      const validProdFrame = {
        url: pathToFileURL(expectedPath).href + '#/settings',
      } as any;
      expect(isTrustedRendererFrame(validProdFrame)).toBe(true);

      (app as any).isPackaged = false;
    });
  });
});
