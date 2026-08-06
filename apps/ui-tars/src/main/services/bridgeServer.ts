/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';

import { logger } from '../logger';
import { store } from '../store/create';
import { SettingStore } from '../store/setting';
import { sanitizeState } from '../utils/sanitizeState';
import { ipcRoutes } from '../ipcRoutes';
import { UTIOService } from './utio';
import {
  validateSettingUpdate,
  maskSettings,
  isMaskedSecret,
  type LocalStore,
} from '../store/validate';

const sseClients = new Set<http.ServerResponse>();
let activeHttpServer: http.Server | null = null;

// Cryptographically secure random session token for bridge server authentication
let activeBridgeToken: string =
  process.env.ORBIT_BRIDGE_TOKEN || crypto.randomBytes(32).toString('hex');

export function getBridgeToken(): string {
  return activeBridgeToken;
}

export function setBridgeToken(token: string): void {
  activeBridgeToken = token;
}

export function getLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

export function broadcastStateToWeb(state: unknown) {
  const sanitized = sanitizeState(state as Record<string, unknown>);
  const payload = `data: ${JSON.stringify(sanitized)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function broadcastSettingToWeb(setting: unknown) {
  const masked =
    typeof setting === 'object' && setting !== null
      ? maskSettings(setting as Record<string, any>)
      : setting;
  const payload = `event: setting-updated\ndata: ${JSON.stringify(masked)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Strictly allowed loopback origins
function isAllowedOrigin(originHeader: string | undefined): boolean {
  if (!originHeader) {
    // Non-browser or direct local same-process requests
    return true;
  }
  try {
    const parsed = new URL(originHeader);
    const hostname = parsed.hostname;
    // Only permit local loopback origins
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

// DNS rebinding attack protection: validate Host header
function isAllowedHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return true;
  const hostWithoutPort = hostHeader.split(':')[0];
  return hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1';
}

function extractToken(req: http.IncomingMessage, url: URL): string | null {
  const headerToken = req.headers['x-orbit-token'];
  if (typeof headerToken === 'string' && headerToken) {
    return headerToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken;
  }
  return null;
}

function isValidToken(providedToken: string | null | undefined): boolean {
  if (!providedToken || typeof providedToken !== 'string') {
    return false;
  }
  const expected = Buffer.from(activeBridgeToken, 'utf-8');
  const provided = Buffer.from(providedToken, 'utf-8');
  if (expected.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, provided);
}

// Allowlist of safe, approved IPC channels callable via the HTTP bridge
const ALLOWED_IPC_CHANNELS = new Set([
  'getState',
  'setting:get',
  'setting:update',
  'setting:clear',
  'setting:resetPreset',
  'setting:importPresetFromText',
  'setting:importPresetFromUrl',
  'setting:updatePresetFromRemote',
  'utio:shareReport',
  'app:getLanInfo',
  'diagnose:mouse',
  // Approved procedures from internal ipcRoutes
  'runAgent',
  'pauseRun',
  'resumeRun',
  'stopRun',
  'getEnsurePermissions',
  'getScreenSources',
  'getPrimaryScreen',
  'showMainWindow',
  'hideMainWindow',
  'minimizeWindow',
  'maximizeWindow',
  'closeWindow',
  'isMaximized',
  'openBrowser',
]);

export function startBridgeServer(port = 5174): http.Server {
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;

    // Check origin
    if (origin) {
      if (isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, x-orbit-token',
        );
      } else {
        logger.warn(`[bridgeServer] Blocked unauthorized origin: ${origin}`);
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: Origin not allowed' }));
        return;
      }
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Protect against DNS rebinding
    if (!isAllowedHost(req.headers.host)) {
      logger.warn(`[bridgeServer] Blocked invalid host header: ${req.headers.host}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Host header not allowed' }));
      return;
    }

    const url = new URL(
      req.url || '/',
      `http://${req.headers.host || '127.0.0.1'}`,
    );

    // GET /api/ip - Returns available LAN IP addresses (informational, loopback-restricted)
    if (req.method === 'GET' && url.pathname === '/api/ip') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ips: getLanIps(),
          uiPort: 5173,
          bridgePort: port,
        }),
      );
      return;
    }

    // All endpoints below require valid local session token authentication
    const token = extractToken(req, url);
    if (!isValidToken(token)) {
      logger.warn(
        `[bridgeServer] Unauthorized request to ${url.pathname} (method: ${req.method})`,
      );
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Unauthorized: Missing or invalid bridge authentication token',
        }),
      );
      return;
    }

    // GET /api/state - Returns current sanitized state (Authenticated)
    if (req.method === 'GET' && url.pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sanitizeState(store.getState())));
      return;
    }

    // GET /api/events - Server-Sent Events stream for real-time state & setting updates (Authenticated)
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Send initial state
      res.write(`data: ${JSON.stringify(sanitizeState(store.getState()))}\n\n`);
      sseClients.add(res);

      // Heartbeat ping every 15s to keep connections alive
      const pingInterval = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clearInterval(pingInterval);
          sseClients.delete(res);
        }
      }, 15000);
      pingInterval.unref();

      req.on('close', () => {
        clearInterval(pingInterval);
        sseClients.delete(res);
      });
      return;
    }

    // POST /api/ipc - Bridge IPC invocations from authorized clients (Authenticated)
    if (req.method === 'POST' && url.pathname === '/api/ipc') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          let parsed: any;
          try {
            parsed = JSON.parse(body || '{}');
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
            return;
          }

          const { channel, args = [] } = parsed;

          // Reject prototype pollution or invalid channel types
          if (
            !channel ||
            typeof channel !== 'string' ||
            channel === '__proto__' ||
            channel === 'constructor' ||
            channel === 'prototype'
          ) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid IPC channel' }));
            return;
          }

          // Enforce strict allowlist
          if (!ALLOWED_IPC_CHANNELS.has(channel)) {
            logger.warn(
              `[bridgeServer] Rejected call to unapproved IPC channel: ${channel}`,
            );
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: `Forbidden or unapproved IPC channel: ${channel}`,
              }),
            );
            return;
          }

          if (!Array.isArray(args)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Invalid IPC arguments: args must be an array',
              }),
            );
            return;
          }

          let result: any;

          if (channel === 'getState') {
            result = sanitizeState(store.getState());
          } else if (channel === 'diagnose:mouse') {
            // Safe mouse diagnostic replacement without shell execution
            const action =
              args && typeof args[0] === 'string' ? args[0] : 'doubleClick';
            const allowedActions = [
              'click',
              'doubleClick',
              'rightClick',
              'move',
            ];
            if (!allowedActions.includes(action)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: `Invalid mouse action: ${action}. Allowed: ${allowedActions.join(', ')}`,
                }),
              );
              return;
            }
            const x = Number(args && args[1]) || 0;
            const y = Number(args && args[2]) || 0;
            if (isNaN(x) || isNaN(y) || x < 0 || y < 0) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error:
                    'Invalid mouse coordinates: x and y must be non-negative numbers',
                }),
              );
              return;
            }
            logger.info(
              `[bridgeServer] diagnose:mouse executed safely (action=${action}, x=${x}, y=${y})`,
            );
            result = {
              success: true,
              message:
                'Mouse diagnostic validated safely without shell execution',
              action,
              x,
              y,
            };
          } else if (channel === 'setting:get') {
            const current = SettingStore.getStore();
            result = maskSettings(current);
          } else if (channel === 'setting:update') {
            const rawSetting = args[0];
            if (
              !rawSetting ||
              typeof rawSetting !== 'object' ||
              Array.isArray(rawSetting)
            ) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error:
                    'Invalid setting payload: expected an object containing settings',
                }),
              );
              return;
            }

            let validatedUpdate: Partial<LocalStore>;
            try {
              validatedUpdate = validateSettingUpdate(rawSetting);
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: `Invalid setting update payload: ${err?.message || String(err)}`,
                }),
              );
              return;
            }

            const current = SettingStore.getStore();
            // Preserve existing credentials if masked value is passed
            if (
              validatedUpdate.vlmApiKey !== undefined &&
              isMaskedSecret(validatedUpdate.vlmApiKey)
            ) {
              validatedUpdate.vlmApiKey = current.vlmApiKey;
            }

            const merged = { ...current, ...validatedUpdate };
            SettingStore.setStore(merged as LocalStore);
            result = { success: true };
          } else if (channel === 'setting:clear') {
            SettingStore.clear();
            result = { success: true };
          } else if (channel === 'setting:resetPreset') {
            SettingStore.getInstance().delete('presetSource');
            result = { success: true };
          } else if (channel === 'setting:importPresetFromText') {
            if (typeof args[0] !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: 'Invalid preset YAML: expected string',
                }),
              );
              return;
            }
            const newSettings = await SettingStore.importPresetFromText(args[0]);
            SettingStore.setStore(newSettings);
            result = maskSettings(newSettings);
          } else if (channel === 'setting:importPresetFromUrl') {
            if (typeof args[0] !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: 'Invalid preset URL: expected string',
                }),
              );
              return;
            }
            const newSettings = await SettingStore.fetchPresetFromUrl(args[0]);
            const fullSettings = {
              ...newSettings,
              presetSource: {
                type: 'remote' as const,
                url: args[0],
                autoUpdate: Boolean(args[1]),
                lastUpdated: Date.now(),
              },
            };
            SettingStore.setStore(fullSettings);
            result = maskSettings(fullSettings);
          } else if (channel === 'setting:updatePresetFromRemote') {
            const settings = SettingStore.getStore();
            if (
              settings.presetSource?.type === 'remote' &&
              settings.presetSource.url
            ) {
              const newSettings = await SettingStore.fetchPresetFromUrl(
                settings.presetSource.url,
              );
              const fullSettings = {
                ...newSettings,
                presetSource: {
                  type: 'remote' as const,
                  url: settings.presetSource.url,
                  autoUpdate: settings.presetSource.autoUpdate,
                  lastUpdated: Date.now(),
                },
              };
              SettingStore.setStore(fullSettings);
              result = maskSettings(fullSettings);
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: 'No remote preset configured',
                }),
              );
              return;
            }
          } else if (channel === 'utio:shareReport') {
            await UTIOService.getInstance().shareReport(args[0]);
            result = { success: true };
          } else if (channel === 'app:getLanInfo') {
            result = { ips: getLanIps(), port: 5173, bridgePort: port };
          } else if (channel && channel in ipcRoutes) {
            // For agent:run, ensure instructions are valid
            if (channel === 'agent:run') {
              const input = args[0];
              if (
                !input ||
                typeof input !== 'object' ||
                typeof input.instructions !== 'string'
              ) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    error:
                      'Invalid agent:run input: instructions string is required',
                  }),
                );
                return;
              }
            }
            result = await (ipcRoutes as any)[channel].handle({
              context: { sender: null },
              input: args[0],
            });
          } else {
            throw new Error(`Unknown or unsupported IPC channel: ${channel}`);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: result }));
        } catch (err: any) {
          logger.error('[bridgeServer] IPC error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err?.message || String(err) }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  activeHttpServer = server;

  // Bind strictly to 127.0.0.1 (Loopback only)
  server.listen(port, '127.0.0.1', () => {
    logger.info(`[bridgeServer] listening exclusively on 127.0.0.1:${port}`);
    console.log(
      '\n============================================================',
    );
    console.log('🔒 Orbit Bridge Server (Localhost Loopback Only):');
    console.log(`   Address: http://127.0.0.1:${port}`);
    console.log('   Status:  Active (Token Authentication Enforced)');
    console.log(
      '============================================================\n',
    );
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(
        `[bridgeServer] Port ${port} is in use, trying ${port + 1}...`,
      );
      startBridgeServer(port + 1);
    } else {
      logger.error('[bridgeServer] Server error:', err);
    }
  });

  return server;
}

export function stopBridgeServer(): Promise<void> {
  return new Promise((resolve) => {
    for (const client of sseClients) {
      try {
        client.destroy();
      } catch {}
    }
    sseClients.clear();
    if (activeHttpServer) {
      activeHttpServer.closeAllConnections?.();
      activeHttpServer.close(() => {
        activeHttpServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

