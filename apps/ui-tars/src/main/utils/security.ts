/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, WebFrameMain } from 'electron';
import * as env from '../env';

export function isTrustedRendererFrame(
  frame: WebFrameMain | null | undefined,
): boolean {
  if (!frame) return false;
  const frameUrl = frame.url;
  if (!frameUrl) return false;

  // In development: Allow the configured electron-vite dev renderer URL
  const devUrl = env.rendererUrl || process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devUrl) {
    try {
      const allowedOrigin = new URL(devUrl).origin;
      const parsedFrame = new URL(frameUrl);
      if (parsedFrame.origin === allowedOrigin) {
        return true;
      }
    } catch {}
  }

  // In production / packaged or local build:
  // Must match the exact file URL of the bundled renderer index.html
  try {
    const expectedFilePath = path.resolve(__dirname, '../renderer/index.html');
    const expectedFileUrl = pathToFileURL(expectedFilePath).href;
    const frameBaseUrl = frameUrl.split('#')[0].split('?')[0];

    const normExpected =
      process.platform === 'win32'
        ? expectedFileUrl.toLowerCase()
        : expectedFileUrl;
    const normFrame =
      process.platform === 'win32'
        ? frameBaseUrl.toLowerCase()
        : frameBaseUrl;

    if (normFrame === normExpected) {
      return true;
    }
  } catch {}

  return false;
}
