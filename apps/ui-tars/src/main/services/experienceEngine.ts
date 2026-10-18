import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { logger } from '../logger';

export interface ActionSummary {
  step: number;
  action_type: string;
  thought?: string;
  summary: string;
  action_inputs?: Record<string, any>;
  verified?: boolean;
}

export interface OrbitSkill {
  id: string;
  taskTitle: string;
  keywords: string[];
  apps: string[];
  workflow: ActionSummary[];
  pitfalls: string[];
  successCount: number;
  failureCount: number;
  createdAt: string;
  lastUsedAt: string;
}

export interface OrbitLearnedRule {
  id: string;
  category: 'windows' | 'app_specific' | 'navigation' | 'timing';
  app?: string;
  rule: string;
  confidence: number;
}

export interface ExperienceStoreData {
  version: number;
  skills: OrbitSkill[];
  rules: OrbitLearnedRule[];
  stats: {
    totalTasksExecuted: number;
    totalTasksLearned: number;
    totalGuidanceInjections: number;
    totalPitfallsAvoided: number;
  };
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'for', 'with', 'is', 'it',
  'of', 'please', 'can', 'you', 'i', 'my', 'me', 'do', 'make', 'perform',
  'that', 'this', 'then', 'from', 'at', 'by', 'as', 'into', 'all', 'any'
]);

export class OrbitExperienceEngine {
  private static instance: OrbitExperienceEngine;
  private storePath: string;
  private datasetPath: string;
  private data: ExperienceStoreData;

  private constructor() {
    this.storePath = this.resolveStorePath();
    this.datasetPath = this.resolveDatasetPath();
    this.data = this.loadStore();
  }

  public static getInstance(): OrbitExperienceEngine {
    if (!OrbitExperienceEngine.instance) {
      OrbitExperienceEngine.instance = new OrbitExperienceEngine();
    }
    return OrbitExperienceEngine.instance;
  }

  private resolveStorePath(): string {
    let baseDir = '';
    try {
      if (app && typeof app.getPath === 'function') {
        baseDir = path.join(app.getPath('userData'), 'orbit_experience');
      }
    } catch {}

    if (!baseDir) {
      baseDir = path.resolve(process.cwd(), 'runs', 'orbit_experience');
    }

    try {
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
    } catch (e) {
      logger.warn('[OrbitExperienceEngine] Failed to create storage dir:', e);
    }

    return path.join(baseDir, 'experience_store.json');
  }

  private resolveDatasetPath(): string {
    const runsDir = path.resolve(process.cwd(), 'runs');
    try {
      if (!fs.existsSync(runsDir)) {
        fs.mkdirSync(runsDir, { recursive: true });
      }
    } catch {}
    return path.join(runsDir, 'training_dataset.jsonl');
  }

  private loadStore(): ExperienceStoreData {
    if (fs.existsSync(this.storePath)) {
      try {
        const raw = fs.readFileSync(this.storePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.skills)) {
          logger.info(`[OrbitExperienceEngine] Loaded ${parsed.skills.length} learned skills from ${this.storePath}`);
          return parsed;
        }
      } catch (err) {
        logger.error('[OrbitExperienceEngine] Failed to read store, initializing default:', err);
      }
    }

    const initialData: ExperienceStoreData = {
      version: 1,
      skills: this.getPreseededSkills(),
      rules: this.getPreseededRules(),
      stats: {
        totalTasksExecuted: 0,
        totalTasksLearned: 5,
        totalGuidanceInjections: 0,
        totalPitfallsAvoided: 0,
      },
    };

    this.saveStore(initialData);
    return initialData;
  }

  private saveStore(dataToSave?: ExperienceStoreData): void {
    const d = dataToSave || this.data;
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(d, null, 2), 'utf8');
      // Also save a backup in runs/orbit_experience for dev transparency
      const backupPath = path.resolve(process.cwd(), 'runs', 'orbit_experience', 'experience_store.json');
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(backupPath, JSON.stringify(d, null, 2), 'utf8');
    } catch (err) {
      logger.error('[OrbitExperienceEngine] Error saving store:', err);
    }
  }

  public extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  }

  public detectApps(text: string): string[] {
    const lower = text.toLowerCase();
    const apps: string[] = [];
    if (/excel|spreadsheet|csv|cells|formula|sum\b/i.test(lower)) apps.push('Excel');
    if (/notepad|text editor|\.txt\b|notes\b/i.test(lower)) apps.push('Notepad');
    if (/paint|mspaint|draw|canvas|circle|oval|stickman/i.test(lower)) apps.push('Paint');
    if (/calc|calculator|math\b|multiply|add\b/i.test(lower)) apps.push('Calculator');
    if (/chrome|brave|edge|browser|website|youtube|google|flight|makemytrip|booking/i.test(lower)) apps.push('Browser');
    if (/word|winword|\.docx\b/i.test(lower)) apps.push('Word');
    if (/powerpoint|powerpnt|\.pptx\b|slides/i.test(lower)) apps.push('PowerPoint');
    return apps;
  }

  /**
   * Calculates similarity between task instruction and a learned skill
   */
  private scoreSkillMatch(instruction: string, skill: OrbitSkill): number {
    const inputKeywords = new Set(this.extractKeywords(instruction));
    const inputApps = new Set(this.detectApps(instruction));

    if (inputKeywords.size === 0) return 0;

    let matchedKeywords = 0;
    for (const kw of skill.keywords) {
      if (inputKeywords.has(kw)) matchedKeywords++;
    }

    const keywordScore = matchedKeywords / Math.max(inputKeywords.size, skill.keywords.length);

    let appScore = 0;
    for (const a of skill.apps) {
      if (inputApps.has(a)) {
        appScore = 0.35;
        break;
      }
    }

    return keywordScore * 0.65 + appScore;
  }

  /**
   * Retrieves relevant guidance from past experiences to inject into VLM prompt
   */
  public getGuidanceForTask(instruction: string): string | null {
    if (!instruction || !this.data.skills.length) return null;

    let bestSkill: OrbitSkill | null = null;
    let bestScore = 0;

    for (const skill of this.data.skills) {
      const score = this.scoreSkillMatch(instruction, skill);
      if (score > bestScore) {
        bestScore = score;
        bestSkill = skill;
      }
    }

    const detectedApps = this.detectApps(instruction);
    const relevantRules = this.data.rules.filter(
      (r) => !r.app || detectedApps.includes(r.app),
    );

    // If similarity >= 0.30 or matched apps with relevant rules
    if ((bestSkill && bestScore >= 0.30) || relevantRules.length > 0) {
      this.data.stats.totalGuidanceInjections++;
      this.saveStore();

      const lines: string[] = [];
      lines.push('## [ORBIT CONTINUOUS EXPERIENCE MEMORY - LEARNED FROM PREVIOUS RUNS]');

      if (bestSkill && bestScore >= 0.30) {
        bestSkill.lastUsedAt = new Date().toISOString();
        lines.push(`Verified Prior Experience for "${bestSkill.taskTitle}":`);
        lines.push(`(Success rate: ${Math.round((bestSkill.successCount / Math.max(1, bestSkill.successCount + bestSkill.failureCount)) * 100)}%, Verified ${bestSkill.successCount}x)`);
        lines.push('Recommended High-Accuracy Action Flow:');
        for (const w of bestSkill.workflow.slice(0, 8)) {
          lines.push(`  ${w.step}. [${w.action_type.toUpperCase()}] ${w.summary}`);
        }
        if (bestSkill.pitfalls && bestSkill.pitfalls.length > 0) {
          lines.push('Critical Pitfalls to Avoid:');
          for (const p of bestSkill.pitfalls) {
            lines.push(`  - Warning: ${p}`);
          }
        }
      }

      if (relevantRules.length > 0) {
        lines.push('Learned System & App Rules:');
        for (const r of relevantRules.slice(0, 4)) {
          lines.push(`  - [${r.app || 'OS'}]: ${r.rule}`);
        }
      }

      const guidance = lines.join('\n');
      logger.info(`[OrbitExperienceEngine] Injected past experience guidance for "${instruction.slice(0, 40)}" (Score: ${bestScore.toFixed(2)})`);
      return guidance;
    }

    return null;
  }

  /**
   * Starts a tracking session for a new task execution
   */
  public startRunSession(instruction: string, runDir: string): OrbitRunTracker {
    this.data.stats.totalTasksExecuted++;
    this.saveStore();
    return new OrbitRunTracker(this, instruction, runDir);
  }

  /**
   * Records a successfully executed or failed skill into memory
   */
  public recordRunOutcome(
    instruction: string,
    steps: ActionSummary[],
    isSuccess: boolean,
    failureReason?: string,
  ): void {
    const keywords = this.extractKeywords(instruction);
    const apps = this.detectApps(instruction);

    let existingSkill = this.data.skills.find(
      (s) => this.scoreSkillMatch(instruction, s) > 0.65,
    );

    if (isSuccess && steps.length > 0) {
      if (existingSkill) {
        existingSkill.successCount++;
        existingSkill.lastUsedAt = new Date().toISOString();
        // If this run was shorter or cleaner, refine the workflow
        if (steps.length <= existingSkill.workflow.length || existingSkill.workflow.length === 0) {
          existingSkill.workflow = steps;
        }
        logger.info(`[OrbitExperienceEngine] 🧠 Refined existing skill "${existingSkill.taskTitle}" (Success count: ${existingSkill.successCount})`);
      } else {
        const newSkill: OrbitSkill = {
          id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          taskTitle: instruction,
          keywords,
          apps,
          workflow: steps,
          pitfalls: [],
          successCount: 1,
          failureCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        };
        this.data.skills.push(newSkill);
        this.data.stats.totalTasksLearned++;
        logger.info(`[OrbitExperienceEngine] 🌟 Learned and indexed NEW task skill: "${instruction}" (${steps.length} steps)`);
      }
    } else if (!isSuccess) {
      if (existingSkill) {
        existingSkill.failureCount++;
        if (failureReason && !existingSkill.pitfalls.includes(failureReason)) {
          existingSkill.pitfalls.push(failureReason);
        }
      }
      logger.info(`[OrbitExperienceEngine] ⚠️ Recorded failure reflection for "${instruction}"`);
    }

    this.saveStore();
  }

  /**
   * Appends an SFT trajectory record to training dataset for future offline fine-tuning
   */
  public appendTrainingTrajectory(record: Record<string, any>): void {
    try {
      const line = JSON.stringify(record) + '\n';
      fs.appendFileSync(this.datasetPath, line, 'utf8');
      logger.info(`[OrbitExperienceEngine] Appended verified trajectory to ${this.datasetPath}`);
    } catch (e) {
      logger.warn('[OrbitExperienceEngine] Failed to append training trajectory:', e);
    }
  }

  public getStats() {
    return {
      ...this.data.stats,
      totalSkillsCount: this.data.skills.length,
      skills: this.data.skills.map((s) => ({
        id: s.id,
        title: s.taskTitle,
        apps: s.apps,
        successCount: s.successCount,
        stepsCount: s.workflow.length,
      })),
    };
  }

  private getPreseededSkills(): OrbitSkill[] {
    return [
      {
        id: 'skill_notepad_quick_note',
        taskTitle: 'Open Notepad and write note',
        keywords: ['notepad', 'write', 'note', 'save', 'text'],
        apps: ['Notepad'],
        workflow: [
          { step: 1, action_type: 'hotkey', summary: 'Press Win+R to open Run dialog', action_inputs: { key: 'win r' } },
          { step: 2, action_type: 'type', summary: 'Launch notepad executable', action_inputs: { content: 'notepad\\n' } },
          { step: 3, action_type: 'type', summary: 'Type note contents into notepad body' },
          { step: 4, action_type: 'hotkey', summary: 'Press Ctrl+S to save', action_inputs: { key: 'ctrl s' } },
        ],
        pitfalls: ['Do not search via Windows Start menu when Run dialog (Win+R) is available'],
        successCount: 10,
        failureCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      },
      {
        id: 'skill_excel_blank_sheet',
        taskTitle: 'Open Excel and enter tabular data',
        keywords: ['excel', 'spreadsheet', 'data', 'table', 'sheet', 'calculate'],
        apps: ['Excel'],
        workflow: [
          { step: 1, action_type: 'hotkey', summary: 'Press Win+R to open Run dialog', action_inputs: { key: 'win r' } },
          { step: 2, action_type: 'type', summary: 'Launch Excel directly', action_inputs: { content: 'excel\\n' } },
          { step: 3, action_type: 'hotkey', summary: 'Press Enter to select Blank Workbook', action_inputs: { key: 'enter' } },
          { step: 4, action_type: 'click', summary: 'Click cell A1 or paste clipboard TSV data' },
        ],
        pitfalls: ['Avoid typing cell-by-cell for large data; use direct clipboard paste with tab-separated values'],
        successCount: 8,
        failureCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      },
      {
        id: 'skill_paint_drawing',
        taskTitle: 'Open MS Paint and draw shapes',
        keywords: ['paint', 'mspaint', 'draw', 'line', 'oval', 'shape', 'stickman'],
        apps: ['Paint'],
        workflow: [
          { step: 1, action_type: 'hotkey', summary: 'Press Win+R to open Run dialog', action_inputs: { key: 'win r' } },
          { step: 2, action_type: 'type', summary: 'Launch MS Paint directly', action_inputs: { content: 'mspaint\\n' } },
          { step: 3, action_type: 'click', summary: 'Click desired tool (Line, Oval, Brush) in top ribbon' },
          { step: 4, action_type: 'drag', summary: 'Execute hardware drag stroke across canvas coordinates' },
        ],
        pitfalls: ['Always select the tool in top toolbar before dragging on canvas'],
        successCount: 6,
        failureCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      },
      {
        id: 'skill_browser_search',
        taskTitle: 'Open Browser and search or visit website',
        keywords: ['browser', 'brave', 'chrome', 'search', 'website', 'open'],
        apps: ['Browser'],
        workflow: [
          { step: 1, action_type: 'hotkey', summary: 'Press Win+R to open Run dialog', action_inputs: { key: 'win r' } },
          { step: 2, action_type: 'type', summary: 'Launch browser (brave or chrome)', action_inputs: { content: 'brave\\n' } },
          { step: 3, action_type: 'hotkey', summary: 'Press Ctrl+L to focus address bar', action_inputs: { key: 'ctrl l' } },
          { step: 4, action_type: 'type', summary: 'Type URL or query followed by Enter' },
        ],
        pitfalls: ['Use Ctrl+L to reliably select address bar without clicking on web page banners'],
        successCount: 12,
        failureCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      },
      {
        id: 'skill_calc_math',
        taskTitle: 'Open Calculator and calculate',
        keywords: ['calc', 'calculator', 'math', 'calculate', 'numbers'],
        apps: ['Calculator'],
        workflow: [
          { step: 1, action_type: 'hotkey', summary: 'Press Win+R to open Run dialog', action_inputs: { key: 'win r' } },
          { step: 2, action_type: 'type', summary: 'Launch Calculator', action_inputs: { content: 'calc\\n' } },
          { step: 3, action_type: 'type', summary: 'Type mathematical numbers and operators directly' },
        ],
        pitfalls: [],
        successCount: 5,
        failureCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      },
    ];
  }

  private getPreseededRules(): OrbitLearnedRule[] {
    return [
      {
        id: 'rule_win_r_launch',
        category: 'windows',
        rule: 'To launch any app on Windows, always press Win+R and type its executable name (notepad, excel, mspaint, calc, brave, chrome) followed by enter.',
        confidence: 1.0,
      },
      {
        id: 'rule_save_file_ctrl_s',
        category: 'windows',
        rule: 'To save files in any Windows editor, press Ctrl+S, type the filename, and press Enter.',
        confidence: 0.98,
      },
      {
        id: 'rule_browser_address_bar',
        category: 'app_specific',
        app: 'Browser',
        rule: 'In Chrome/Brave, use Ctrl+L to highlight address bar instantly.',
        confidence: 0.95,
      },
    ];
  }
}

/**
 * Tracks individual execution steps of an ongoing task run
 */
export class OrbitRunTracker {
  private engine: OrbitExperienceEngine;
  private instruction: string;
  private runDir: string;
  private steps: ActionSummary[] = [];
  private stepCount = 0;

  constructor(engine: OrbitExperienceEngine, instruction: string, runDir: string) {
    this.engine = engine;
    this.instruction = instruction;
    this.runDir = runDir;
  }

  public recordStep(
    pred: any,
    isStagnant: boolean,
    _actualCoords?: [number, number] | { x: number; y: number } | null,
  ): void {
    if (!pred || !pred.action_type) return;

    this.stepCount++;
    const actionType = String(pred.action_type).toLowerCase();
    let summary = '';

    if (actionType === 'hotkey') {
      const k = pred.action_inputs?.key || '';
      summary = `Hotkey: ${k}`;
    } else if (actionType === 'type') {
      const c = pred.action_inputs?.content || '';
      summary = `Type: "${c.length > 25 ? c.slice(0, 25) + '...' : c}"`;
    } else if (actionType.includes('click')) {
      const box = pred.action_inputs?.start_box;
      summary = `Click at ${box ? JSON.stringify(box) : 'screen element'}`;
    } else if (actionType === 'drag') {
      summary = `Drag stroke from ${pred.action_inputs?.start_box} to ${pred.action_inputs?.end_box}`;
    } else {
      summary = `${actionType}: ${JSON.stringify(pred.action_inputs || {})}`;
    }

    this.steps.push({
      step: this.stepCount,
      action_type: actionType,
      thought: pred.thought,
      summary,
      action_inputs: pred.action_inputs,
      verified: !isStagnant,
    });
  }

  public async finish(isSuccess: boolean, status: string): Promise<void> {
    let failureReason: string | undefined;

    if (!isSuccess) {
      const stagnantSteps = this.steps.filter((s) => !s.verified);
      if (stagnantSteps.length > 0) {
        const lastStag = stagnantSteps[stagnantSteps.length - 1];
        failureReason = `Repeated action [${lastStag.action_type}] (${lastStag.summary}) resulted in stagnant screen state. Verify target element focus or visibility.`;
      } else {
        failureReason = `Execution stopped with status: ${status}. Check prerequisite windows or app state.`;
      }
    }

    // Filter out unverified redundant retry steps from the recorded workflow
    const cleanedSteps = this.steps.filter((s, idx) => {
      if (!s.verified && idx < this.steps.length - 1) return false;
      return true;
    }).map((s, idx) => ({ ...s, step: idx + 1 }));

    this.engine.recordRunOutcome(this.instruction, cleanedSteps, isSuccess, failureReason);

    // Save SFT trajectory pair to dataset ONLY if trajectory is clean and verified
    const hasStagnantOrFailedSteps = this.steps.some((s) => !s.verified);
    if (isSuccess && cleanedSteps.length > 0 && !hasStagnantOrFailedSteps) {
      this.engine.appendTrainingTrajectory({
        instruction: this.instruction,
        runDir: this.runDir,
        timestamp: new Date().toISOString(),
        stepsCount: cleanedSteps.length,
        actions: cleanedSteps.map((s) => ({
          type: s.action_type,
          summary: s.summary,
          inputs: s.action_inputs,
        })),
      });
    } else if (hasStagnantOrFailedSteps) {
      logger.warn(
        `[OrbitExperienceEngine] Trajectory rejected from training dataset: run had stagnant or unverified steps (${this.instruction.slice(0, 50)})`,
      );
    }
  }
}
