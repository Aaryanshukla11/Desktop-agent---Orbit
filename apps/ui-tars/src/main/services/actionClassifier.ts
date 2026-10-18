export type ActionIntent =
  | 'click_element'
  | 'double_click_element'
  | 'set_text'
  | 'focus_window'
  | 'hotkey'
  | 'vlm_fallback';

export interface ClassifiedAction {
  intent: ActionIntent;
  targetName?: string;
  targetType?: string; // 'Button' | 'Edit' | 'MenuItem' | 'CheckBox' | 'Document' | etc.
  windowTitle?: string;
  textToInject?: string;
  hotkey?: string;
  confidence: number; // 0.0 to 1.0
  isNativeCandidate: boolean;
  rawInput: string;
}

/**
 * Normalizes control type synonyms to standard UIAutomation ControlTypes
 */
export function normalizeControlType(rawType?: string): string {
  if (!rawType) return '';
  const t = rawType.trim().toLowerCase();
  if (t === 'btn' || t === 'button') return 'Button';
  if (t === 'edit' || t === 'input' || t === 'textbox' || t === 'field' || t === 'editor') return 'Edit';
  if (t === 'menu' || t === 'menuitem') return 'MenuItem';
  if (t === 'check' || t === 'checkbox') return 'CheckBox';
  if (t === 'radio' || t === 'radiobutton') return 'RadioButton';
  if (t === 'combo' || t === 'combobox' || t === 'select' || t === 'dropdown') return 'ComboBox';
  if (t === 'tab' || t === 'tabitem') return 'TabItem';
  if (t === 'link' || t === 'hyperlink') return 'Hyperlink';
  if (t === 'list' || t === 'listitem') return 'ListItem';
  if (t === 'doc' || t === 'document') return 'Document';
  if (t === 'pane') return 'Pane';
  return rawType;
}

/**
 * Classifies an incoming high-level natural language instruction into a deterministic
 * native execution intent.
 * 
 * Supports:
 * - Click "Save", Click "Calculator 7", Click button "Close", Click menu "File"
 * - Double click "Report.docx"
 * - Type "Hello" into Document, Type "hello" into notepad
 * - Focus window "Notepad", Bring "Calculator" to front
 */
export function classifyAction(instruction: string): ClassifiedAction {
  const raw = (instruction || '').trim();
  if (!raw) {
    return {
      intent: 'vlm_fallback',
      confidence: 0,
      isNativeCandidate: false,
      rawInput: raw,
    };
  }

  // 1. Focus Window Intent: e.g. Focus window "Notepad", Switch to "Calculator", Bring "Excel" to front
  const focusMatch = raw.match(
    /^(?:focus|switch\s+to|activate|bring\s+up|bring\s+(.+?)\s+to\s+front)\s+(?:window\s+)?["']?([a-zA-Z0-9_\s.-]+?)["']?$/i,
  );
  if (focusMatch) {
    const winTitle = (focusMatch[2] || focusMatch[1] || '').trim();
    if (winTitle) {
      return {
        intent: 'focus_window',
        windowTitle: winTitle,
        confidence: 0.95,
        isNativeCandidate: true,
        rawInput: raw,
      };
    }
  }

  // 2. Set Text / Type Intent:
  // e.g. Type "Hello" into Document
  // e.g. Type "123" into "Search bar"
  // e.g. Type "hello world" into notepad
  const typeIntoMatch = raw.match(
    /^(?:type|write|input|enter|set\s+text)\s+["']([^"']+)["']\s+(?:in|into|to|on)\s+(?:the\s+)?(?:(button|menu|checkbox|edit|input|textbox|editor|doc|document)\s+)?["']?([a-zA-Z0-9_\s.-]+?)["']?$/i,
  );
  if (typeIntoMatch) {
    const text = typeIntoMatch[1];
    const rawType = typeIntoMatch[2];
    const target = (typeIntoMatch[3] || '').trim();

    let windowTitle: string | undefined;
    let targetName = target;

    // Check if target is a known app name (e.g. "into notepad")
    const lowerTarget = target.toLowerCase();
    if (['notepad', 'wordpad', 'calc', 'calculator', 'explorer', 'code'].includes(lowerTarget)) {
      windowTitle = target;
      targetName = 'Document'; // default edit pane in Notepad/Wordpad
    }

    return {
      intent: 'set_text',
      textToInject: text,
      targetName: targetName || 'Edit',
      targetType: normalizeControlType(rawType) || 'Edit',
      windowTitle,
      confidence: 0.92,
      isNativeCandidate: true,
      rawInput: raw,
    };
  }

  // 3. Double Click Intent: e.g. Double click "Document", double-click on "File"
  const dblClickMatch = raw.match(
    /^(?:double\s*click|double-click)\s+(?:on\s+)?(?:the\s+)?(?:(button|menu|item|icon|file)\s+)?["']?([^"']+)["']?$/i,
  );
  if (dblClickMatch) {
    const rawType = dblClickMatch[1];
    const target = dblClickMatch[2].trim();
    return {
      intent: 'double_click_element',
      targetName: target,
      targetType: normalizeControlType(rawType) || 'ListItem',
      confidence: 0.9,
      isNativeCandidate: true,
      rawInput: raw,
    };
  }

  // 4. Click Element Intent:
  // e.g. Click "Save"
  // e.g. Click "Calculator 7" -> window "Calculator", target "7"
  // e.g. Click button "Close"
  // e.g. Click menu "File"
  // e.g. Click "Seven" on "Calculator"
  const clickCompoundMatch = raw.match(
    /^(?:click|press|tap|hit|select)\s+(?:on\s+)?(?:the\s+)?(?:(button|menu|menuitem|checkbox|tab|link|item|radio|combo)\s+)?["']([^"']+)["'](?:\s+(?:in|on|of)\s+["']?([a-zA-Z0-9_\s.-]+?)["']?)?$/i,
  );
  if (clickCompoundMatch) {
    const rawType = clickCompoundMatch[1];
    let target = clickCompoundMatch[2].trim();
    let winTitle = clickCompoundMatch[3]?.trim();

    // Special case for composite names like: Click "Calculator 7"
    if (!winTitle && target.includes(' ')) {
      const parts = target.split(/\s+/);
      const firstWord = parts[0].toLowerCase();
      if (['calculator', 'calc', 'notepad', 'settings', 'explorer'].includes(firstWord)) {
        winTitle = parts[0];
        target = parts.slice(1).join(' ');
      }
    }

    return {
      intent: 'click_element',
      targetName: target,
      targetType: normalizeControlType(rawType) || 'Button',
      windowTitle: winTitle,
      confidence: 0.9,
      isNativeCandidate: true,
      rawInput: raw,
    };
  }

  // 5. Unquoted Click fallback: e.g. Click Save, Click File, Click 7
  const unquotedClickMatch = raw.match(
    /^(?:click|press|tap|hit|select)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_.-]+)(?:\s+(?:in|on)\s+([a-zA-Z0-9_.-]+))?$/i,
  );
  if (unquotedClickMatch) {
    const target = unquotedClickMatch[1].trim();
    const winTitle = unquotedClickMatch[2]?.trim();
    const stopWords = ['a', 'an', 'the', 'it', 'here', 'there', 'this', 'that', 'button', 'icon'];
    if (!stopWords.includes(target.toLowerCase())) {
      return {
        intent: 'click_element',
        targetName: target,
        targetType: 'Button',
        windowTitle: winTitle,
        confidence: 0.82,
        isNativeCandidate: true,
        rawInput: raw,
      };
    }
  }

  // Default fallback to pure VLM agent
  return {
    intent: 'vlm_fallback',
    confidence: 0.3,
    isNativeCandidate: false,
    rawInput: raw,
  };
}

/**
 * Classifies a sub-step prediction generated by the VLM model.
 * Inspects model `thought`, `action_type`, and `action_inputs` to determine
 * whether a native Tier-1 element interaction can replace raw coordinate clicks.
 */
export function classifyVlmPrediction(
  thought: string,
  actionType: string,
  actionInputs?: Record<string, any>,
): ClassifiedAction {
  const t = (thought || '').trim();
  const at = (actionType || '').trim().toLowerCase();

  // 1. Direct type action
  if (at === 'type') {
    const content = (actionInputs?.content || '').toString();
    return {
      intent: 'set_text',
      textToInject: content,
      targetType: 'Edit',
      confidence: 0.85,
      isNativeCandidate: Boolean(content),
      rawInput: `${actionType}: ${content}`,
    };
  }

  // 2. Direct hotkey action
  if (at === 'hotkey') {
    const key = (actionInputs?.key || '').toString();
    return {
      intent: 'hotkey',
      hotkey: key,
      confidence: 0.95,
      isNativeCandidate: true,
      rawInput: `${actionType}: ${key}`,
    };
  }

  // 3. Mouse click actions: inspect thought for semantic targets
  if (at === 'click' || at === 'left_single' || at === 'left_click' || at === 'left_double' || at === 'double_click') {
    const isDouble = at.includes('double');

    // Check for quoted element names in thought: e.g. "click 'Save'", "press the 'Plus' button"
    const quotedMatch = t.match(
      /(?:click|press|select|choose|tap|hit|focus)\s+(?:on\s+)?(?:the\s+)?["']([a-zA-Z0-9_\s-]{1,35}?)["']/i,
    );
    if (quotedMatch && quotedMatch[1]) {
      const targetName = quotedMatch[1].trim();
      return {
        intent: isDouble ? 'double_click_element' : 'click_element',
        targetName,
        targetType: 'Button',
        confidence: 0.88,
        isNativeCandidate: true,
        rawInput: t,
      };
    }

    // Check for named control keywords: e.g. "click the save button", "click calculator 7"
    const namedMatch = t.match(
      /(?:click|press|select|tap)\s+(?:on\s+)?(?:the\s+)?([a-zA-Z0-9_-]{2,20})\s+(?:button|menu|tab|item|checkbox)/i,
    );
    if (namedMatch && namedMatch[1]) {
      const targetName = namedMatch[1].trim();
      const stopWords = ['a', 'an', 'the', 'it', 'this', 'that'];
      if (!stopWords.includes(targetName.toLowerCase())) {
        return {
          intent: isDouble ? 'double_click_element' : 'click_element',
          targetName,
          targetType: 'Button',
          confidence: 0.8,
          isNativeCandidate: true,
          rawInput: t,
        };
      }
    }
  }

  return {
    intent: 'vlm_fallback',
    confidence: 0.4,
    isNativeCandidate: false,
    rawInput: t,
  };
}
