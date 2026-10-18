import { describe, it, expect } from 'vitest';
import {
  classifyAction,
  classifyVlmPrediction,
  normalizeControlType,
} from '../actionClassifier';

describe('ActionClassifier', () => {
  describe('normalizeControlType', () => {
    it('normalizes common synonyms', () => {
      expect(normalizeControlType('btn')).toBe('Button');
      expect(normalizeControlType('button')).toBe('Button');
      expect(normalizeControlType('edit')).toBe('Edit');
      expect(normalizeControlType('textbox')).toBe('Edit');
      expect(normalizeControlType('menu')).toBe('MenuItem');
      expect(normalizeControlType('checkbox')).toBe('CheckBox');
      expect(normalizeControlType('doc')).toBe('Document');
    });
  });

  describe('classifyAction', () => {
    it('classifies Click "Save" accurately', () => {
      const result = classifyAction('Click "Save"');
      expect(result.intent).toBe('click_element');
      expect(result.targetName).toBe('Save');
      expect(result.targetType).toBe('Button');
      expect(result.isNativeCandidate).toBe(true);
    });

    it('classifies composite Click "Calculator 7" accurately', () => {
      const result = classifyAction('Click "Calculator 7"');
      expect(result.intent).toBe('click_element');
      expect(result.windowTitle).toBe('Calculator');
      expect(result.targetName).toBe('7');
      expect(result.isNativeCandidate).toBe(true);
    });

    it('classifies Click button "Close" with explicit type', () => {
      const result = classifyAction('Click button "Close"');
      expect(result.intent).toBe('click_element');
      expect(result.targetName).toBe('Close');
      expect(result.targetType).toBe('Button');
      expect(result.isNativeCandidate).toBe(true);
    });

    it('classifies Type "Hello" into Document', () => {
      const result = classifyAction('Type "Hello" into Document');
      expect(result.intent).toBe('set_text');
      expect(result.textToInject).toBe('Hello');
      expect(result.targetName).toBe('Document');
      expect(result.targetType).toBe('Edit');
      expect(result.isNativeCandidate).toBe(true);
    });

    it('classifies Type "Hello World" into Notepad', () => {
      const result = classifyAction('Type "Hello World" into Notepad');
      expect(result.intent).toBe('set_text');
      expect(result.textToInject).toBe('Hello World');
      expect(result.windowTitle).toBe('Notepad');
      expect(result.isNativeCandidate).toBe(true);
    });

    it('classifies Focus window "Notepad"', () => {
      const result = classifyAction('Focus window "Notepad"');
      expect(result.intent).toBe('focus_window');
      expect(result.windowTitle).toBe('Notepad');
      expect(result.isNativeCandidate).toBe(true);
    });

    it('classifies Double click "Report.docx"', () => {
      const result = classifyAction('Double click "Report.docx"');
      expect(result.intent).toBe('double_click_element');
      expect(result.targetName).toBe('Report.docx');
      expect(result.isNativeCandidate).toBe(true);
    });

    it('falls back to VLM for complex ambiguous instructions', () => {
      const result = classifyAction('Find a nice recipe for pasta and summarize it');
      expect(result.intent).toBe('vlm_fallback');
      expect(result.isNativeCandidate).toBe(false);
    });
  });

  describe('classifyVlmPrediction', () => {
    it('extracts quoted click targets from VLM thought', () => {
      const result = classifyVlmPrediction(
        'I need to click on the "Save" button to keep changes',
        'click',
        { start_box: '[100, 200, 150, 250]' },
      );
      expect(result.intent).toBe('click_element');
      expect(result.targetName).toBe('Save');
      expect(result.isNativeCandidate).toBe(true);
    });

    it('classifies VLM type action', () => {
      const result = classifyVlmPrediction(
        'Typing user name into the field',
        'type',
        { content: 'John Doe' },
      );
      expect(result.intent).toBe('set_text');
      expect(result.textToInject).toBe('John Doe');
      expect(result.isNativeCandidate).toBe(true);
    });

    it('classifies VLM hotkey action', () => {
      const result = classifyVlmPrediction(
        'Pressing enter to submit',
        'hotkey',
        { key: 'enter' },
      );
      expect(result.intent).toBe('hotkey');
      expect(result.hotkey).toBe('enter');
      expect(result.isNativeCandidate).toBe(true);
    });
  });
});
