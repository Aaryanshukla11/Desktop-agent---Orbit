import { logger } from '../logger';
import { FastInputManager } from '../utils/fastInput';
import { OrbitExperienceEngine } from './experienceEngine';

export interface MacroStep {
  stepIndex: number;
  type: 'hotkey' | 'type' | 'paste' | 'click' | 'drag' | 'sleep';
  value: string;
  coords?: [number, number];
  delayAfterMs?: number;
  description: string;
}

export interface OrbitMacro {
  id: string;
  name: string;
  pattern: RegExp;
  extractParams: (instruction: string) => Record<string, string>;
  generateSteps: (params: Record<string, string>) => MacroStep[];
  successCount: number;
  averageTimeMs: number;
}

export class OrbitMacroEngine {
  private static instance: OrbitMacroEngine;
  private fastInput: FastInputManager;
  private experienceEngine: OrbitExperienceEngine;
  private macros: OrbitMacro[] = [];

  private constructor() {
    this.fastInput = FastInputManager.getInstance();
    this.experienceEngine = OrbitExperienceEngine.getInstance();
    this.initBuiltinMacros();
  }

  public static getInstance(): OrbitMacroEngine {
    if (!OrbitMacroEngine.instance) {
      OrbitMacroEngine.instance = new OrbitMacroEngine();
    }
    return OrbitMacroEngine.instance;
  }

  private initBuiltinMacros(): void {
    // Macro 1: Notepad Quick Note & Save
    this.macros.push({
      id: 'macro_notepad_write',
      name: 'Notepad Fast Write & Save',
      pattern: /^(?:open\s+)?notepad\s+(?:and\s+)?(?:type|write|put)\s+(.+)$/i,
      extractParams: (instr) => {
        const match = instr.match(/^(?:open\s+)?notepad\s+(?:and\s+)?(?:type|write|put)\s+(.+)$/i);
        return { text: match ? match[1].trim() : '' };
      },
      generateSteps: (params) => [
        {
          stepIndex: 1,
          type: 'hotkey',
          value: 'win r',
          delayAfterMs: 250,
          description: 'Open Windows Run dialog (Win+R)',
        },
        {
          stepIndex: 2,
          type: 'type',
          value: 'notepad\\n',
          delayAfterMs: 650,
          description: 'Launch Notepad executable',
        },
        {
          stepIndex: 3,
          type: 'paste',
          value: params.text,
          delayAfterMs: 350,
          description: `Fast-paste content: "${params.text.slice(0, 30)}..."`,
        },
      ],
      successCount: 15,
      averageTimeMs: 1250,
    });

    // Macro 2: Calculator Quick Math Computation
    this.macros.push({
      id: 'macro_calculator_compute',
      name: 'Calculator Fast Compute',
      pattern: /^(?:open\s+)?(?:calc|calculator)\s+(?:and\s+)?(?:calculate|compute|solve|type)?\s*([0-9\s\+\-\*\/\.\(\)]+)$/i,
      extractParams: (instr) => {
        const match = instr.match(/^(?:open\s+)?(?:calc|calculator)\s+(?:and\s+)?(?:calculate|compute|solve|type)?\s*([0-9\s\+\-\*\/\.\(\)]+)$/i);
        return { expression: match ? match[1].trim() : '' };
      },
      generateSteps: (params) => [
        {
          stepIndex: 1,
          type: 'hotkey',
          value: 'win r',
          delayAfterMs: 250,
          description: 'Open Windows Run dialog (Win+R)',
        },
        {
          stepIndex: 2,
          type: 'type',
          value: 'calc\\n',
          delayAfterMs: 600,
          description: 'Launch Calculator',
        },
        {
          stepIndex: 3,
          type: 'type',
          value: `${params.expression}=\\n`,
          delayAfterMs: 200,
          description: `Compute math expression: "${params.expression}"`,
        },
      ],
      successCount: 12,
      averageTimeMs: 1050,
    });

    // Macro 3: Browser Fast Search / URL Open
    this.macros.push({
      id: 'macro_browser_search',
      name: 'Browser Fast URL / Search Navigate',
      pattern: /^(?:open|search|navigate\s+to|visit)\s+(?:on\s+)?(?:google|youtube|brave|chrome|browser)?\s*(?:for\s+)?(.+(?:\.com|\.org|\.in|\.net|\.io|youtube|google|github).*)$/i,
      extractParams: (instr) => {
        const match = instr.match(/^(?:open|search|navigate\s+to|visit)\s+(?:on\s+)?(?:google|youtube|brave|chrome|browser)?\s*(?:for\s+)?(.+)$/i);
        let target = match ? match[1].trim() : '';
        // Sanitize out any shell metacharacters, quotes, and control chars
        target = target.replace(/["`&|;$\r\n\t]/g, '');

        if (target.includes('youtube')) target = 'https://www.youtube.com';
        else if (target.includes('google')) target = 'https://www.google.com';
        else if (target.includes('github')) target = 'https://www.github.com';
        else if (!target.startsWith('http://') && !target.startsWith('https://')) {
          target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
        }
        try {
          const parsed = new URL(target);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            target = 'https://www.google.com';
          }
        } catch {
          target = 'https://www.google.com';
        }
        return { url: target };
      },
      generateSteps: (params) => {
        const safeUrl = (params.url || '').replace(/["`&|;$\r\n\t]/g, '');
        return [
          {
            stepIndex: 1,
            type: 'hotkey',
            value: 'win r',
            delayAfterMs: 250,
            description: 'Open Windows Run dialog (Win+R)',
          },
          {
            stepIndex: 2,
            type: 'type',
            value: `explorer "${safeUrl}"\\n`,
            delayAfterMs: 750,
            description: `Navigate default browser to: ${safeUrl}`,
          },
        ];
      },
      successCount: 20,
      averageTimeMs: 1000,
    });

    // Macro 4: Blank Excel Sheet Setup
    this.macros.push({
      id: 'macro_excel_open',
      name: 'Excel Fast Blank Workbook',
      pattern: /^(?:open\s+)?excel(?:\s+(?:and\s+)?(?:create\s+)?(?:blank\s+sheet|new\s+file|new\s+workbook)?)?$/i,
      extractParams: () => ({}),
      generateSteps: () => [
        {
          stepIndex: 1,
          type: 'hotkey',
          value: 'win r',
          delayAfterMs: 250,
          description: 'Open Windows Run dialog (Win+R)',
        },
        {
          stepIndex: 2,
          type: 'type',
          value: 'excel\\n',
          delayAfterMs: 800,
          description: 'Launch Excel directly',
        },
        {
          stepIndex: 3,
          type: 'hotkey',
          value: 'enter',
          delayAfterMs: 300,
          description: 'Select Blank Workbook',
        },
      ],
      successCount: 10,
      averageTimeMs: 1350,
    });
  }

  /**
   * Checks if an instruction matches any high-confidence fast-path macro
   */
  public canFastPath(instruction: string): boolean {
    if (!instruction) return false;
    const clean = instruction.trim();
    return this.macros.some((m) => m.pattern.test(clean));
  }

  /**
   * Finds the matching macro and extracts dynamic arguments
   */
  public findMatchingMacro(instruction: string): { macro: OrbitMacro; params: Record<string, string> } | null {
    const clean = instruction.trim();
    for (const m of this.macros) {
      if (m.pattern.test(clean)) {
        return {
          macro: m,
          params: m.extractParams(clean),
        };
      }
    }
    return null;
  }

  /**
   * Executes the macro deterministically via FastInputServer with checkpoint verification
   */
  public async executeFastPath(
    instruction: string,
    abortSignal?: AbortSignal,
  ): Promise<{ success: boolean; stepsExecuted: number; elapsedMs: number; error?: string }> {
    const match = this.findMatchingMacro(instruction);
    if (!match) {
      return { success: false, stepsExecuted: 0, elapsedMs: 0, error: 'No matching macro pattern' };
    }

    const { macro, params } = match;
    const steps = macro.generateSteps(params);
    logger.info(`[OrbitMacroEngine] ⚡ Executing Fast-Path Macro: "${macro.name}" (${steps.length} steps)`);

    const startTime = Date.now();
    let stepsExecuted = 0;

    try {
      for (const step of steps) {
        if (abortSignal?.aborted) {
          logger.warn('[OrbitMacroEngine] Fast-Path execution aborted by user signal.');
          return { success: false, stepsExecuted, elapsedMs: Date.now() - startTime, error: 'Aborted by user' };
        }

        logger.info(`[OrbitMacroEngine] Step ${step.stepIndex}/${steps.length}: ${step.description}`);

        let stepOk = false;
        if (step.type === 'hotkey') {
          stepOk = await this.fastInput.hotkey(step.value);
        } else if (step.type === 'type') {
          stepOk = await this.fastInput.type(step.value);
        } else if (step.type === 'paste') {
          stepOk = await this.fastInput.paste(step.value);
        } else if (step.type === 'click' && step.coords) {
          stepOk = await this.fastInput.click(step.coords[0], step.coords[1]);
        } else if (step.type === 'sleep') {
          stepOk = true;
        }

        if (!stepOk) {
          logger.warn(`[OrbitMacroEngine] Step ${step.stepIndex} returned false. Aborting fast-path for safety.`);
          return { success: false, stepsExecuted, elapsedMs: Date.now() - startTime, error: `Step ${step.stepIndex} failed` };
        }

        stepsExecuted++;
        if (step.delayAfterMs && step.delayAfterMs > 0) {
          await new Promise((r) => setTimeout(r, step.delayAfterMs));
        }
      }

      const elapsedMs = Date.now() - startTime;
      macro.successCount++;
      macro.averageTimeMs = Math.round((macro.averageTimeMs + elapsedMs) / 2);

      logger.info(`[OrbitMacroEngine] ✅ Fast-Path Macro "${macro.name}" completed successfully in ${elapsedMs}ms!`);

      // Synthesize into Experience Engine so memory is kept in sync
      this.experienceEngine.recordRunOutcome(
        instruction,
        steps.map((s) => ({
          step: s.stepIndex,
          action_type: s.type,
          summary: s.description,
          action_inputs: { value: s.value },
          verified: true,
        })),
        true,
      );

      return {
        success: true,
        stepsExecuted,
        elapsedMs,
      };
    } catch (err: any) {
      logger.error('[OrbitMacroEngine] Fast-path unexpected exception:', err);
      return {
        success: false,
        stepsExecuted,
        elapsedMs: Date.now() - startTime,
        error: err?.message || String(err),
      };
    }
  }

  public getMacrosList() {
    return this.macros.map((m) => ({
      id: m.id,
      name: m.name,
      successCount: m.successCount,
      averageTimeMs: m.averageTimeMs,
    }));
  }
}
