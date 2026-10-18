import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckpointVerifier } from '../checkpointVerifier';
import { FastInputManager } from '../../utils/fastInput';

vi.mock('../../utils/fastInput', () => {
  const mockFastInput = {
    findElement: vi.fn(),
    getActiveWindow: vi.fn(),
    getFocusedInfo: vi.fn(),
  };
  return {
    FastInputManager: {
      getInstance: () => mockFastInput,
    },
    fastInput: mockFastInput,
  };
});

describe('CheckpointVerifier', () => {
  let verifier: CheckpointVerifier;
  let mockFastInput: any;

  beforeEach(() => {
    vi.clearAllMocks();
    verifier = CheckpointVerifier.getInstance();
    mockFastInput = FastInputManager.getInstance();
  });

  describe('isCriticalCheckpoint', () => {
    it('identifies save actions as checkpoints', () => {
      expect(verifier.isCriticalCheckpoint('Click "Save"')).toBe(true);
      expect(verifier.isCriticalCheckpoint('Save as report.docx')).toBe(true);
      expect(verifier.isCriticalCheckpoint('Press Ctrl+S')).toBe(true);
    });

    it('identifies calculate / equals actions as checkpoints', () => {
      expect(verifier.isCriticalCheckpoint('Click "="')).toBe(true);
      expect(verifier.isCriticalCheckpoint('compute 125 * 8')).toBe(true);
      expect(verifier.isCriticalCheckpoint('calculate sum')).toBe(true);
    });

    it('identifies submit and delete actions as checkpoints', () => {
      expect(verifier.isCriticalCheckpoint('Click Submit')).toBe(true);
      expect(verifier.isCriticalCheckpoint('Delete temporary files')).toBe(true);
    });

    it('ignores intermediate micro-actions', () => {
      expect(verifier.isCriticalCheckpoint('Click on Menu')).toBe(false);
      expect(verifier.isCriticalCheckpoint('Hover over button')).toBe(false);
      expect(verifier.isCriticalCheckpoint('Type "hello"')).toBe(false);
    });
  });

  describe('verifyNative', () => {
    it('passes non-checkpoint actions immediately with method: none', async () => {
      const res = await verifier.verifyNative('Click Menu');
      expect(res.isCheckpoint).toBe(false);
      expect(res.verified).toBe(true);
      expect(res.method).toBe('none');
    });

    it('verifies Calculator display result natively via UIA', async () => {
      mockFastInput.findElement.mockResolvedValueOnce({
        name: 'Display is 81',
        type: 'Text',
        id: 'CalculatorResults',
      });

      const res = await verifier.verifyNative('compute 9 * 9 =');
      expect(res.isCheckpoint).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.method).toBe('native_uia');
      expect(res.details).toContain('Display is 81');
    });

    it('verifies clean window title for saved files', async () => {
      mockFastInput.getActiveWindow.mockResolvedValueOnce({
        hwnd: 1234,
        title: 'Notes.txt - Notepad',
        process: 'notepad',
      });

      const res = await verifier.verifyNative('Save file');
      expect(res.isCheckpoint).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.method).toBe('native_uia');
    });

    it('flags visual_vlm when native checks are inconclusive', async () => {
      mockFastInput.getActiveWindow.mockResolvedValueOnce(null);
      mockFastInput.getFocusedInfo.mockResolvedValueOnce(null);

      const res = await verifier.verifyNative('Save changes');
      expect(res.isCheckpoint).toBe(true);
      expect(res.verified).toBe(false);
      expect(res.method).toBe('visual_vlm');
    });
  });
});
