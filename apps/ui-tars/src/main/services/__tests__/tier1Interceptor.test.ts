import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tier1Interceptor } from '../tier1Interceptor';
import { FastInputManager } from '../../utils/fastInput';

vi.mock('../../utils/fastInput', () => {
  const mockFastInput = {
    findElement: vi.fn(),
    clickElement: vi.fn(),
    doubleClickElement: vi.fn(),
    setElementText: vi.fn(),
    focusWindowByTitle: vi.fn(),
  };
  return {
    FastInputManager: {
      getInstance: () => mockFastInput,
    },
    fastInput: mockFastInput,
  };
});

describe('Tier1Interceptor', () => {
  let interceptor: Tier1Interceptor;
  let mockFastInput: any;

  beforeEach(() => {
    vi.clearAllMocks();
    interceptor = Tier1Interceptor.getInstance();
    mockFastInput = FastInputManager.getInstance();
  });

  it('bypasses non-native instructions to Tier 2 VLM', async () => {
    const result = await interceptor.intercept('Plan an itinerary for travel');
    expect(result.handled).toBe(false);
    expect(result.tokensSaved).toBe(0);
  });

  it('intercepts Click "Save" when element exists in UIA tree', async () => {
    mockFastInput.findElement.mockResolvedValueOnce({
      name: 'Save',
      type: 'Button',
      id: 'SaveBtn',
      x: 100,
      y: 100,
      width: 50,
      height: 25,
      centerX: 125,
      centerY: 112,
    });
    mockFastInput.clickElement.mockResolvedValueOnce(true);

    const result = await interceptor.intercept('Click "Save"');
    expect(result.handled).toBe(true);
    expect(result.tokensSaved).toBe(2000);
    expect(result.actionTaken).toContain('click_element "Save"');
    expect(mockFastInput.findElement).toHaveBeenCalledWith('Save', expect.anything());
    expect(mockFastInput.clickElement).toHaveBeenCalledWith('Save', expect.anything());
  });

  it('routes to Tier 2 VLM when element is missing from UIA tree', async () => {
    mockFastInput.findElement.mockResolvedValueOnce(null);

    const result = await interceptor.intercept('Click "NonExistentButton"');
    expect(result.handled).toBe(false);
    expect(result.tokensSaved).toBe(0);
    expect(mockFastInput.clickElement).not.toHaveBeenCalled();
  });

  it('intercepts Type "Hello World" into Document', async () => {
    mockFastInput.setElementText.mockResolvedValueOnce(true);

    const result = await interceptor.intercept('Type "Hello World" into Document');
    expect(result.handled).toBe(true);
    expect(result.tokensSaved).toBe(2000);
    expect(mockFastInput.setElementText).toHaveBeenCalledWith('Document', 'Hello World', expect.anything());
  });

  it('intercepts Focus window "Notepad"', async () => {
    mockFastInput.focusWindowByTitle.mockResolvedValueOnce({
      hwnd: 12345,
      process: 'notepad',
      title: 'Untitled - Notepad',
      rect: { x: 0, y: 0, width: 800, height: 600 },
    });

    const result = await interceptor.intercept('Focus window "Notepad"');
    expect(result.handled).toBe(true);
    expect(result.tokensSaved).toBe(2000);
    expect(mockFastInput.focusWindowByTitle).toHaveBeenCalledWith('Notepad');
  });
});
