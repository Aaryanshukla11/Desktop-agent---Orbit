/**
 * Orbit Beta: Device Auth Neutralized
 * Zero hardware fingerprinting. No external device registration.
 */
import crypto from 'node:crypto';
import { logger } from '../logger';

let cachedDeviceId: string | null = null;
async function getDeviceId(): Promise<string> {
  if (!cachedDeviceId) {
    cachedDeviceId = 'orbit-device-' + crypto.randomBytes(16).toString('hex');
    logger.debug('[Orbit Security] Local anonymous device ID generated.');
  }
  return cachedDeviceId;
}

async function getAuthHeader() {
  const deviceId = await getDeviceId();
  const ts = Date.now().toString();
  return {
    'X-Device-Id': deviceId,
    'X-Timestamp': ts,
    Authorization: 'Bearer orbit-local-token',
  };
}

async function registerDevice(): Promise<boolean> {
  logger.debug('[Orbit Security] Local device registration approved.');
  return true;
}

export { getAuthHeader, registerDevice };

