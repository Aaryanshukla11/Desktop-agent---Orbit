/*
 
 */
import {
  ActionInputs,
  PredictionParsed,
  UITarsModelVersion,
  MAX_RATIO,
  IMAGE_FACTOR,
  MIN_PIXELS,
  MAX_PIXELS_V1_5,
} from '@UI-TARs/shared/types';
import isNumber from 'lodash.isnumber';

function roundByFactor(num: number, factor: number): number {
  return Math.round(num / factor) * factor;
}

function floorByFactor(num: number, factor: number): number {
  return Math.floor(num / factor) * factor;
}

function ceilByFactor(num: number, factor: number): number {
  return Math.ceil(num / factor) * factor;
}

function smartResizeForV15(
  height: number,
  width: number,
  maxRatio: number = MAX_RATIO,
  factor: number = IMAGE_FACTOR,
  minPixels: number = MIN_PIXELS,
  maxPixels: number = MAX_PIXELS_V1_5,
): [number, number] | null {
  if (Math.max(height, width) / Math.min(height, width) > maxRatio) {
    console.error(
      `absolute aspect ratio must be smaller than ${maxRatio}, got ${
        Math.max(height, width) / Math.min(height, width)
      }`,
    );
    return null;
  }

  let wBar = Math.max(factor, roundByFactor(width, factor));
  let hBar = Math.max(factor, roundByFactor(height, factor));

  if (hBar * wBar > maxPixels) {
    const beta = Math.sqrt((height * width) / maxPixels);
    hBar = floorByFactor(height / beta, factor);
    wBar = floorByFactor(width / beta, factor);
  } else if (hBar * wBar < minPixels) {
    const beta = Math.sqrt(minPixels / (height * width));
    hBar = ceilByFactor(height * beta, factor);
    wBar = ceilByFactor(width * beta, factor);
  }

  return [wBar, hBar];
}

export function actionParser(params: {
  prediction: string;
  /** [widthFactor, heightFactor] */
  factor: number | [number, number];
  screenContext?: {
    width: number;
    height: number;
  };
  scaleFactor?: number;
  mode?: 'bc' | 'o1';
  modelVer?: UITarsModelVersion;
}): {
  parsed: PredictionParsed[];
} {
  const { prediction, factor, mode, screenContext, scaleFactor, modelVer } =
    params;

  const parsed = parseActionVlm(
    prediction,
    Array.isArray(factor) ? factor : [factor, factor],
    mode,
    screenContext,
    scaleFactor,
    modelVer,
  );

  return {
    parsed,
  };
}

export function parseActionVlm(
  text: string,
  factors: [number, number] = [1000, 1000],
  mode: 'bc' | 'o1' = 'bc',
  screenContext?: {
    width: number;
    height: number;
  },
  scaleFactor?: number,
  modelVer: UITarsModelVersion = UITarsModelVersion.V1_0,
): PredictionParsed[] {
  let reflection: string | null = null;
  let thought: string | null = null;
  let actionStr = '';

  let smartResizeFactors: [number, number] | null = null;
  if (
    modelVer === UITarsModelVersion.V1_5 &&
    screenContext?.height &&
    screenContext?.width
  ) {
    smartResizeFactors = smartResizeForV15(
      screenContext.height,
      screenContext.width,
    );
  }

  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (mode === 'bc') {
    // Parse thought/reflection based on different text patterns
    if (text.includes('Thought:')) {
      const thoughtMatch = text.match(
        /Thought: ([\s\S]+?)(?=\s*Action[:：]|$)/,
      );

      if (thoughtMatch) {
        thought = thoughtMatch[1].trim();
      }
    } else if (text.startsWith('Reflection:')) {
      const reflectionMatch = text.match(
        /Reflection: ([\s\S]+?)Action_Summary: ([\s\S]+?)(?=\s*Action[:：]|$)/,
      );
      if (reflectionMatch) {
        thought = reflectionMatch[2].trim();
        reflection = reflectionMatch[1].trim();
      }
    } else if (text.startsWith('Action_Summary:')) {
      const summaryMatch = text.match(
        /Action_Summary: (.+?)(?=\s*Action[:：]|$)/,
      );
      if (summaryMatch) {
        thought = summaryMatch[1].trim();
      }
    }

    if (['Action:', 'Action：'].some((keyword) => text.includes(keyword))) {
      const actionParts = text.split(/Action[:：]/);
      actionStr = actionParts[actionParts.length - 1];
    } else {
      actionStr = text;
    }
    // Remove markdown code fences and backticks from actionStr
    actionStr = actionStr
      .replace(/```[a-zA-Z]*\n?/g, '')
      .replace(/```/g, '')
      .trim();
  } else if (mode === 'o1') {
    // Parse o1 format
    const thoughtMatch = text.match(/<Thought>\s*(.*?)\s*<\/Thought>/);
    const actionSummaryMatch = text.match(
      /\nAction_Summary:\s*(.*?)\s*Action:/,
    );
    const actionMatch = text.match(/\nAction:\s*(.*?)\s*<\/Output>/);

    const thoughtContent = thoughtMatch ? thoughtMatch[1] : null;
    const actionSummaryContent = actionSummaryMatch
      ? actionSummaryMatch[1]
      : null;
    const actionContent = actionMatch ? actionMatch[1] : null;

    thought = `${thoughtContent}\n<Action_Summary>\n${actionSummaryContent}`;
    actionStr = (actionContent || '')
      .replace(/```[a-zA-Z]*\n?/g, '')
      .replace(/```/g, '')
      .trim();
  }

  // Strip numbered or bulleted list prefixes (e.g. "1. click(...)" -> "click(...)")
  actionStr = actionStr
    .replace(/^\s*\d+[\.\)]\s*/gm, '')
    .replace(/^\s*[-*•]\s*/gm, '');

  // Parse actions: match function calls like click(...)
  const functionCallRegex =
    /\b([a-zA-Z_]\w*)\s*\(([\s\S]*?)\)(?=(?:\s*[a-zA-Z_]\w*\s*\(|$))/g;
  const matches = Array.from(actionStr.matchAll(functionCallRegex));
  let allActions: string[] = [];
  if (matches.length > 0) {
    allActions = matches.map((m) => m[0].trim());
  } else {
    allActions = actionStr
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const actions: PredictionParsed[] = [];

  for (const rawStr of allActions) {
    const actionInstance = parseAction(
      rawStr.replace(/\n/g, String.raw`\n`).trim(),
    );
    let actionType = '';
    let actionInputs: ActionInputs = {};

    if (actionInstance) {
      actionType = actionInstance.function;
      const params = actionInstance.args;
      actionInputs = {};

      for (const [paramName, param] of Object.entries(params)) {
        if (!param) continue;
        const trimmedParam = (param as string).trim();

        if (paramName.includes('start_box') || paramName.includes('end_box')) {
          const oriBox = trimmedParam;
          // Remove parentheses, brackets and split
          const numbers = oriBox
            .replace(/[()[\]]/g, '')
            .split(',')
            .map((s) => s.trim())
            .filter((ori) => ori !== '');

          // Check if coordinates are already normalized floats (0.0 to 1.0)
          const allFloats = numbers.every((n) => {
            const val = Number.parseFloat(n);
            return !Number.isNaN(val) && val >= 0 && val <= 1.0;
          });
          const isAlreadyNormalized =
            allFloats &&
            numbers.some(
              (n) => Number.parseFloat(n) > 0 && Number.parseFloat(n) < 1.0,
            );

          // Convert to float and scale
          const floatNumbers = numbers.map((num, idx) => {
            const parsedVal = Number.parseFloat(num);
            if (Number.isNaN(parsedVal)) return 0;
            if (isAlreadyNormalized) {
              return parsedVal;
            }
            const factorIndex = idx % 2;
            if (modelVer === UITarsModelVersion.V1_5 && smartResizeFactors) {
              return parsedVal / smartResizeFactors[factorIndex];
            }
            return parsedVal / factors[factorIndex];
          });

          if (floatNumbers.length === 2) {
            floatNumbers.push(floatNumbers[0], floatNumbers[1]);
          }

          actionInputs[
            paramName.trim() as keyof Omit<
              ActionInputs,
              'start_coords' | 'end_coords'
            >
          ] = JSON.stringify(floatNumbers);

          if (screenContext?.width && screenContext?.height) {
            const boxKey = paramName.includes('start_box')
              ? 'start_coords'
              : 'end_coords';
            const [x1, y1, x2 = x1, y2 = y1] = floatNumbers;
            const [widthFactor, heightFactor] = factors;

            const mult = (screenContext.width > 1920 || screenContext.height > 1080) ? 1 : (scaleFactor ?? 1);
            actionInputs[boxKey] = [x1, y1, x2, y2].every(isNumber)
              ? [
                  (Math.round(
                    ((x1 + x2) / 2) * screenContext?.width * widthFactor,
                  ) /
                    widthFactor) *
                    mult,
                  (Math.round(
                    ((y1 + y2) / 2) * screenContext?.height * heightFactor,
                  ) /
                    heightFactor) *
                    mult,
                ]
              : [];
          }
        } else {
          actionInputs[
            paramName.trim() as keyof Omit<
              ActionInputs,
              'start_coords' | 'end_coords'
            >
          ] = trimmedParam;
        }
      }
    }

    actions.push({
      reflection: reflection,
      thought: thought || '',
      action_type: actionType,
      action_inputs: actionInputs,
    });
  }

  return actions;
}

/**
 * Parses an action string into a structured object
 * @param {string} actionStr - The action string to parse (e.g. "click(start_box='(279,81)')")
 * @returns {Object|null} Parsed action object or null if parsing fails
 */
function parseAction(actionStr: string) {
  try {
    actionStr = actionStr.trim().replace(/^`+|`+$/g, '').trim();

    // Support format: click(start_box='<|box_start|>(x1,y1)<|box_end|>')
    actionStr = actionStr.replace(/<\|box_start\|>|<\|box_end\|>/g, '');

    // Support format: click(point='<point>510 150</point>') => click(start_box='<point>510 150</point>')
    // Support format: drag(start_point='<point>458 328</point>', end_point='<point>350 309</point>') => drag(start_box='<point>458 328</point>', end_box='<point>350 309</point>')
    actionStr = actionStr
      .replace(/(?<!start_|end_)point=/g, 'start_box=')
      .replace(/start_point=/g, 'start_box=')
      .replace(/end_point=/g, 'end_box=');

    // Auto-heal unclosed/truncated action calls (e.g. when VLM hits token limit while typing long content)
    if (!actionStr.endsWith(')') && /^[a-zA-Z_]\w*\s*\(/.test(actionStr)) {
      if (actionStr.endsWith("'") || actionStr.endsWith('"')) {
        actionStr = actionStr + ')';
      } else {
        actionStr = actionStr + "')";
      }
    }

    // Match function name and arguments using regex
    const functionPattern = /^([a-zA-Z_]\w*)\s*\(([\s\S]*)\)$/;
    const match = actionStr.match(functionPattern);

    if (!match) {
      throw new Error('Not a function call');
    }

    const [_, functionName, argsStr] = match;

    // Parse keyword arguments
    const kwargs: Record<string, string> = {};

    if (argsStr.trim()) {
      // Split on commas that aren't inside quotes or brackets or parentheses
      const argPairs =
        argsStr.match(
          /([^,"'(\[]+|"[^"]*"|'[^']*'|\([^)]*\)|\[[^\]]*\])+/g,
        ) || [];

      for (const pair of argPairs) {
        const trimmedPair = pair.trim();
        if (!trimmedPair) continue;

        if (trimmedPair.includes('=')) {
          const [key, ...valueParts] = trimmedPair.split('=');
          if (!key) continue;

          let value = valueParts
            .join('=')
            .trim()
            .replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes

          // Support format: click(start_box='<bbox>637 964 637 964</bbox>')
          if (value.includes('<bbox>')) {
            value = value.replace(/<bbox>|<\/bbox>/g, '').replace(/\s+/g, ',');
            value = `(${value})`;
          }

          // Support format: click(point='<point>510 150</point>')
          if (value.includes('<point>')) {
            value = value.replace(/<point>|<\/point>/g, '').replace(/\s+/g, ',');
            value = `(${value})`;
          }

          kwargs[key.trim()] = value;
        } else {
          // Positional argument support
          const value = trimmedPair.replace(/^['"]|['"]$/g, '');
          if (
            functionName === 'hotkey' ||
            functionName === 'press' ||
            functionName === 'release'
          ) {
            kwargs['key'] = value;
          } else if (functionName === 'type') {
            kwargs['content'] = value;
          } else if (functionName === 'finished') {
            kwargs['content'] = value;
          } else if (
            functionName.includes('click') ||
            functionName.includes('single') ||
            functionName.includes('double')
          ) {
            kwargs['start_box'] = value;
          }
        }
      }
    }

    return {
      function: functionName,
      args: kwargs,
    };
  } catch (e) {
    console.error(`Failed to parse action '${actionStr}': ${e}`);
    return null;
  }
}
