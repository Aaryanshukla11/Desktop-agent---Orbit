/**
 
 */
import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';

import { logger } from '@main/logger';
import { StatusEnum, UITarsModelVersion } from '@UI-TARs/shared/types';
import { type ConversationWithSoM } from '@main/shared/types';
import { GUIAgent, type GUIAgentConfig } from '@UI-TARs/sdk';
import { markClickPosition } from '@main/utils/image';
import { UTIOService } from '@main/services/utio';
import { NutJSElectronOperator } from '../agent/operator';
import {
  createRemoteBrowserOperator,
  RemoteComputerOperator,
} from '../remote/operators';
import {
  DefaultBrowserOperator,
  RemoteBrowserOperator,
} from '@UI-TARs/operator-browser';
import { showPredictionMarker } from '@main/window/ScreenMarker';
import { SettingStore } from '@main/store/setting';
import { AppState, Operator, VLMProviderV2 } from '@main/store/types';
import { GUIAgentManager } from '../ipcRoutes/agent';
import { checkBrowserAvailability } from './browserCheck';
import {
  getModelVersion,
  getSpByModelVersion,
  beforeAgentRun,
  afterAgentRun,
  getLocalBrowserSearchEngine,
} from '../utils/agent';
import { FREE_MODEL_BASE_URL } from '../remote/shared';
import { getAuthHeader } from '../remote/auth';
import { ProxyClient } from '../remote/proxyClient';
import { UITarsModelConfig } from '@UI-TARs/sdk/core';
import { OrbitExperienceEngine } from './experienceEngine';
import { OrbitMacroEngine } from './macroEngine';
import { isExcelTask, runExcelTask } from '../specialists/excel/excelChatRouter';
import { Tier1Interceptor } from './tier1Interceptor';
import { CheckpointVerifier } from './checkpointVerifier';
import { fastInput } from '../utils/fastInput';

export const runAgent = async (
  setState: (state: AppState) => void,
  getState: () => AppState,
) => {
  logger.info('runAgent');
  const settings = SettingStore.getStore();
  const { instructions, abortController } = getState();
  assert(instructions, 'instructions is required');

  const language = settings.language ?? 'en';

  logger.info('settings.operator', settings.operator);

  const t0Timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const t0RunDir = path.resolve(process.cwd(), 'runs', `T0-${t0Timestamp}`);
  try {
    fs.mkdirSync(t0RunDir, { recursive: true });
    logger.info('[T0 Evidence] Directory created at', t0RunDir);
  } catch (err) {
    logger.error('[T0 Evidence] Failed to create directory:', err);
  }

  const experienceEngine = OrbitExperienceEngine.getInstance();
  const runTracker = experienceEngine.startRunSession(instructions, t0RunDir);

  const macroEngine = OrbitMacroEngine.getInstance();
  if (settings.operator === Operator.LocalComputer && macroEngine.canFastPath(instructions)) {
    logger.info('[runAgent] ⚡ Instruction eligible for Fast-Path Macro execution!');
    const fastRes = await macroEngine.executeFastPath(instructions, abortController?.signal);
    if (fastRes.success) {
      logger.info(`[runAgent] ✅ Fast-path executed in ${fastRes.elapsedMs}ms! Skipping full VLM agent loop.`);
      await runTracker.finish(true, 'FAST_PATH_COMPLETED');
      const macroFinishedMsg = {
        from: 'assistant',
        value: `Task completed via Fast-Path in ${fastRes.elapsedMs}ms (${fastRes.stepsExecuted} steps executed).`,
        predictionParsed: [
          {
            action_type: 'finished',
            action_inputs: {
              content: `Task completed via Fast-Path in ${fastRes.elapsedMs}ms.`,
            },
          },
        ],
      };
      setState({
        ...getState(),
        status: StatusEnum.END,
        messages: [...(getState().messages || []), macroFinishedMsg as any],
      });
      return;
    } else {
      logger.info('[runAgent] Fast-path skipped or encountered condition, continuing to full VLM Agent.');
    }
  }

  // Autonomous Excel Specialist Fast-Path Interceptor
  if (process.platform === 'win32' && isExcelTask(instructions)) {
    logger.info('[runAgent] Routing to Autonomous Excel Specialist Agent (ExcelMcp Live Mode)!');

      // Desktop takeover: hide main window, show floating widget pill & neon border glow
      await beforeAgentRun(settings.operator);

      try {
        const excelRes = await runExcelTask(instructions, (statusMsg, pct) => {
          logger.info(`[runAgent] Excel Specialist progress: ${statusMsg} (${pct}%)`);
          const progressMessage = {
            from: 'assistant',
            value: statusMsg,
            predictionParsed: [
              {
                action_type: 'thought',
                thought: `[${pct}%] ${statusMsg}`,
                action_inputs: {
                  content: statusMsg,
                },
              },
            ],
          };
          setState({
            ...getState(),
            messages: [...(getState().messages || []), progressMessage as any],
          });
        });

        if (excelRes.success) {
          await runTracker.finish(true, 'EXCEL_SPECIALIST_COMPLETED');
          const finishedMessage = {
            from: 'assistant',
            value: excelRes.summaryMarkdown,
            logContent: (excelRes as any).logMarkdown,
            predictionParsed: [
              {
                action_type: 'finished',
                action_inputs: {
                  content: excelRes.summaryMarkdown,
                },
              },
            ],
          };
          setState({
            ...getState(),
            status: StatusEnum.END,
            messages: [...(getState().messages || []), finishedMessage as any],
          });
          return;
        } else {
          logger.warn('[runAgent] Excel Specialist completed with issue:', excelRes.summaryMarkdown);
          await runTracker.finish(false, 'EXCEL_SPECIALIST_FAILED');
          const failureMessage = {
            from: 'assistant',
            value: excelRes.summaryMarkdown,
            predictionParsed: [
              {
                action_type: 'finished',
                action_inputs: {
                  content: excelRes.summaryMarkdown,
                },
              },
            ],
          };
          setState({
            ...getState(),
            status: StatusEnum.END,
            errorMsg: excelRes.summaryMarkdown,
            messages: [...(getState().messages || []), failureMessage as any],
          });
          return;
        }
      } catch (err: any) {
        logger.error('[runAgent] Excel Specialist execution threw error:', err);
        await runTracker.finish(false, 'EXCEL_SPECIALIST_ERROR');
        setState({
          ...getState(),
          status: StatusEnum.END,
          errorMsg: err?.message || String(err),
        });
        return;
      } finally {
        // Restore Orbit main window smoothly after task completes
        afterAgentRun(settings.operator);
      }
    }

  // Tier-1 Fast-Path Interceptor: Before invoking vlm.predict() with a 2,000-token screenshot,
  // test if the element exists in the current foreground window's UIA tree. If yes, fire instant native click.
  if (settings.operator === Operator.LocalComputer && process.platform === 'win32') {
    const tier1 = Tier1Interceptor.getInstance();
    const t1Res = await tier1.intercept(instructions);
    if (t1Res.handled) {
      logger.info(
        `[runAgent] ⚡ Tier-1 Native UIA execution completed in ${t1Res.elapsedMs}ms! Tokens saved: ${t1Res.tokensSaved}. Action: ${t1Res.actionTaken}`,
      );

      // Step 3.4 Checkpoint-Based Verification
      const verifier = CheckpointVerifier.getInstance();
      const cpResult = await verifier.verifyNative(instructions, {
        windowTitle: t1Res.windowTitle,
      });

      if (cpResult.isCheckpoint) {
        logger.info(
          `[runAgent] 🏁 Checkpoint evaluated: method=${cpResult.method}, verified=${cpResult.verified}, details="${cpResult.details || ''}"`,
        );
      }

      if (cpResult.verified || !cpResult.isCheckpoint) {
        await runTracker.finish(true, 'TIER1_NATIVE_COMPLETED');
        const t1FinishedMsg = {
          from: 'assistant',
          value: `Action executed natively: ${t1Res.actionTaken} (${t1Res.elapsedMs}ms, ${t1Res.tokensSaved} tokens saved).`,
          predictionParsed: [
            {
              action_type: 'finished',
              action_inputs: {
                content: `Action executed natively: ${t1Res.actionTaken}`,
              },
            },
          ],
        };
        setState({
          ...getState(),
          status: StatusEnum.END,
          messages: [...(getState().messages || []), t1FinishedMsg as any],
        });
        return;
      } else {
        logger.info(
          `[runAgent] ⚠️ Native checkpoint check was inconclusive (${cpResult.details}). Routing to Tier-2 VLM for final visual verification screenshot...`,
        );
      }
    } else {
      logger.info(
        `[runAgent] 🔄 Tier-1 Native check yielded no match (${t1Res.reason || 'element not in UIA tree'} in ${t1Res.elapsedMs}ms). Seamlessly triggering Smart Tier-2 VLM Fallback with visual screenshot...`,
      );
      // Auto-stabilize: If a specific target window was requested, bring it to the foreground so the VLM screenshot captures the right window
      if (t1Res.windowTitle) {
        try {
          await fastInput.focusWindowByTitle(t1Res.windowTitle);
        } catch (e) {
          logger.warn('[runAgent] Auto-stabilization window focus warning:', e);
        }
      }
    }
  }

  let screenshotIndex = 0;
  const runtimeRecords: any[] = [];
  let lastActionName = 'initial';
  let lastRunScreenshotBase64: string | null = null;
  let isCurrentStepStagnant = false;
  let consecutiveStagnantSteps = 0;
  let lastActionSignature = '';

  const handleData: GUIAgentConfig<NutJSElectronOperator>['onData'] = async ({
    data,
  }) => {
    const lastConv = getState().messages[getState().messages.length - 1];
    const { status, conversations, ...restUserData } = data;
    logger.info('[onGUIAgentData] status', status, conversations.length);

    // T0 evidence capture
    for (const conv of conversations) {
      if (conv.screenshotBase64) {
        if (lastRunScreenshotBase64) {
          const lenDiff = Math.abs(conv.screenshotBase64.length - lastRunScreenshotBase64.length);
          isCurrentStepStagnant =
            conv.screenshotBase64 === lastRunScreenshotBase64 ||
            (lenDiff < 500 && conv.screenshotBase64.slice(1000, 5000) === lastRunScreenshotBase64.slice(1000, 5000));
        }
        lastRunScreenshotBase64 = conv.screenshotBase64;

        try {
          const stepPrefix = String(screenshotIndex).padStart(2, '0');
          const fileName =
            screenshotIndex === 0
              ? `${stepPrefix}_initial.png`
              : `${stepPrefix}_after_${lastActionName}.png`;
          const filePath = path.join(t0RunDir, fileName);
          fs.writeFileSync(filePath, Buffer.from(conv.screenshotBase64, 'base64'));
          logger.info(`[T0 Evidence] Saved screenshot to ${filePath}`);
          screenshotIndex++;
        } catch (err) {
          logger.error('[T0 Evidence] error saving screenshot:', err);
        }
      }

      if (conv.predictionParsed && conv.predictionParsed.length > 0) {
        for (const pred of conv.predictionParsed) {
          runTracker.recordStep(pred, isCurrentStepStagnant, NutJSElectronOperator.lastCoords);
          lastActionName = (pred.action_type || 'action')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_');
          const rawBox = pred.action_inputs?.start_box;
          let normCoords: number[] | null = null;
          if (rawBox) {
            try {
              normCoords = typeof rawBox === 'string' ? JSON.parse(rawBox) : rawBox;
            } catch {}
          }

          const curActionSignature = `${pred.action_type}:${JSON.stringify(pred.action_inputs || {})}`;
          const isIdenticalAction = curActionSignature === lastActionSignature;
          lastActionSignature = curActionSignature;

          if (isCurrentStepStagnant || isIdenticalAction) {
            consecutiveStagnantSteps++;
          } else {
            consecutiveStagnantSteps = 0;
          }

          const verifiedStatus =
            status === StatusEnum.END
              ? 'TASK_COMPLETED'
              : (isCurrentStepStagnant ? 'STAGNANT_SCREEN_ACTION_INEFFECTIVE' : 'ACTION_EFFECT_VERIFIED');

          runtimeRecords.push({
            loop: Math.max(0, screenshotIndex - 1),
            vlm_raw_response: conv.value,
            parsed_action: pred,
            normalized_coordinates: normCoords,
            actual_screen_coordinates: NutJSElectronOperator.lastCoords,
            action_execution_result: status,
            screenshot_timestamp: new Date().toISOString(),
            verification_result: verifiedStatus,
          });
          try {
            fs.writeFileSync(
              path.join(t0RunDir, 'runtime.json'),
              JSON.stringify(runtimeRecords, null, 2),
            );
          } catch (err) {
            logger.error('[T0 Evidence] error writing runtime.json:', err);
          }

          // Loop Breaker: If 2 consecutive identical drag actions or 3 stagnant steps occur, break loop immediately!
          const isStuckDrag = isIdenticalAction && pred.action_type === 'drag' && consecutiveStagnantSteps >= 2;
          const isStuckGeneral = consecutiveStagnantSteps >= 3 && status !== StatusEnum.END;

          if (isStuckDrag || isStuckGeneral) {
            logger.warn(
              `[runAgent] 🛑 Repetitive action/stagnation loop detected (${consecutiveStagnantSteps} steps for action ${pred.action_type}). Breaking loop to prevent infinite token consumption.`,
            );

            // Release any stuck hardware drag / mouse capture
            if (process.platform === 'win32') {
              try {
                await fastInput.hotkey('esc');
              } catch {}
            }

            try {
              abortController?.abort();
            } catch {}

            const breakerMsg = {
              from: 'assistant',
              value: `Action execution halted: Orbit detected repetitive ${pred.action_type} attempts with no visual progress on screen. Automatically stopped to conserve tokens.`,
              predictionParsed: [
                {
                  action_type: 'finished',
                  action_inputs: {
                    content: 'Execution stopped automatically to break repetitive loop.',
                  },
                },
              ],
            };

            setState({
              ...getState(),
              status: StatusEnum.END,
              messages: [...(getState().messages || []), breakerMsg as any],
            });
            return;
          }
        }
      }
    }

    // add SoM to conversations
    const conversationsWithSoM: ConversationWithSoM[] = await Promise.all(
      conversations.map(async (conv) => {
        const { screenshotContext, predictionParsed } = conv;
        if (
          lastConv?.screenshotBase64 &&
          screenshotContext?.size &&
          predictionParsed
        ) {
          const screenshotBase64WithElementMarker = await markClickPosition({
            screenshotContext,
            base64: lastConv?.screenshotBase64,
            parsed: predictionParsed,
          }).catch((e) => {
            logger.error('[markClickPosition error]:', e);
            return '';
          });
          return {
            ...conv,
            screenshotBase64WithElementMarker,
          };
        }
        return conv;
      }),
    ).catch((e) => {
      logger.error('[conversationsWithSoM error]:', e);
      return conversations;
    });

    const {
      screenshotBase64,
      predictionParsed,
      screenshotContext,
      screenshotBase64WithElementMarker,
      ...rest
    } = conversationsWithSoM?.[conversationsWithSoM.length - 1] || {};
    logger.info(
      '[onGUIAgentData] ======data======\n',
      predictionParsed,
      screenshotContext,
      rest,
      status,
      '\n========',
    );

    if (
      settings.operator === Operator.LocalComputer &&
      predictionParsed?.length &&
      screenshotContext?.size &&
      !abortController?.signal?.aborted
    ) {
      showPredictionMarker(predictionParsed, screenshotContext);
    }

    setState({
      ...getState(),
      status,
      restUserData,
      messages: [...(getState().messages || []), ...conversationsWithSoM],
    });
  };

  let operatorType: 'computer' | 'browser' = 'computer';
  let operator:
    | NutJSElectronOperator
    | DefaultBrowserOperator
    | RemoteComputerOperator
    | RemoteBrowserOperator;

  switch (settings.operator) {
    case Operator.LocalComputer:
      operator = new NutJSElectronOperator();
      operatorType = 'computer';
      break;
    case Operator.LocalBrowser:
      await checkBrowserAvailability();
      const { browserAvailable } = getState();
      if (!browserAvailable) {
        setState({
          ...getState(),
          status: StatusEnum.ERROR,
          errorMsg:
            'Browser is not available. Please install Chrome and try again.',
        });
        return;
      }

      operator = await DefaultBrowserOperator.getInstance(
        false,
        false,
        false,
        getState().status === StatusEnum.CALL_USER,
        getLocalBrowserSearchEngine(settings.searchEngineForBrowser),
      );
      operatorType = 'browser';
      break;
    case Operator.RemoteComputer:
      operator = await RemoteComputerOperator.create();
      operatorType = 'computer';
      break;
    case Operator.RemoteBrowser:
      operator = await createRemoteBrowserOperator();
      operatorType = 'browser';
      break;
    default:
      break;
  }

  let modelVersion = getModelVersion(settings.vlmProvider);
  let resolvedBaseUrl = settings.vlmBaseUrl?.trim();
  if (resolvedBaseUrl?.includes('platform.openai.com')) {
    resolvedBaseUrl = 'https://api.openai.com/v1';
  }
  if (resolvedBaseUrl === 'https://api.openai.com' || resolvedBaseUrl === 'https://api.openai.com/') {
    resolvedBaseUrl = 'https://api.openai.com/v1';
  }

  const isOpenAI =
    settings.vlmProvider === VLMProviderV2.openai ||
    Boolean(resolvedBaseUrl?.includes('api.openai.com')) ||
    Boolean(settings.vlmModelName?.toLowerCase().startsWith('gpt')) ||
    Boolean(settings.vlmModelName?.toLowerCase().startsWith('o1')) ||
    Boolean(settings.vlmModelName?.toLowerCase().startsWith('o3'));

  if (isOpenAI) {
    modelVersion = UITarsModelVersion.V1_0;
  }

  let modelConfig: UITarsModelConfig = {
    baseURL: resolvedBaseUrl,
    apiKey: settings.vlmApiKey,
    model: settings.vlmModelName,
    useResponsesApi: isOpenAI ? false : settings.useResponsesApi,
  };
  let modelAuthHdrs: Record<string, string> = {};

  if (
    settings.operator === Operator.RemoteComputer ||
    settings.operator === Operator.RemoteBrowser
  ) {
    const useResponsesApi = await ProxyClient.getRemoteVLMResponseApiSupport();
    modelConfig = {
      baseURL: FREE_MODEL_BASE_URL,
      apiKey: '',
      model: '',
      useResponsesApi,
    };
    modelAuthHdrs = await getAuthHeader();
    modelVersion = await ProxyClient.getRemoteVLMProvider();
  }

  const rawSystemPrompt = getSpByModelVersion(
    modelVersion,
    language,
    operatorType,
  );

  const experienceGuidance = experienceEngine.getGuidanceForTask(instructions);
  const systemPrompt = experienceGuidance
    ? `${rawSystemPrompt}\n\n${experienceGuidance}`
    : rawSystemPrompt;

  const guiAgent = new GUIAgent({
    model: modelConfig,
    systemPrompt: systemPrompt,
    logger,
    signal: abortController?.signal,
    operator: operator!,
    onData: handleData,
    onError: (params) => {
      const { error } = params;
      logger.error('[onGUIAgentError]', settings, error);
      setState({
        ...getState(),
        status: StatusEnum.ERROR,
        errorMsg: JSON.stringify({
          status: error?.status,
          message: error?.message,
          stack: error?.stack,
        }),
      });
    },
    retry: {
      model: {
        maxRetries: 5,
      },
      screenshot: {
        maxRetries: 5,
      },
      execute: {
        maxRetries: 1,
      },
    },
    maxLoopCount: settings.maxLoopCount,
    loopIntervalInMs: settings.loopIntervalInMs,
    uiTarsVersion: modelVersion,
  });

  GUIAgentManager.getInstance().setAgent(guiAgent);
  UTIOService.getInstance().sendInstruction(instructions);

  const { sessionHistoryMessages } = getState();

  beforeAgentRun(settings.operator);
  const startTime = Date.now();

  try {
    await guiAgent
      .run(instructions, sessionHistoryMessages, modelAuthHdrs)
      .catch((e) => {
        logger.error('[runAgentLoop error]', e);
        setState({
          ...getState(),
          status: StatusEnum.ERROR,
          errorMsg: e.message,
        });
      });

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('[runAgent Total cost]: ', totalDuration, 's');

    const isFinalSuccess = getState().status === StatusEnum.END;
    await runTracker.finish(isFinalSuccess, getState().status);

    const loopCount = runtimeRecords.length;
    const estTokens = loopCount * 2200;

    // Persist structured task telemetry
    try {
      fs.writeFileSync(
        path.join(t0RunDir, 'task_telemetry.json'),
        JSON.stringify(
          {
            instruction: instructions,
            engine: 'VLM Vision Loop',
            durationSeconds: Number(totalDuration),
            tokensConsumed: estTokens,
            stepsCount: loopCount,
            status: isFinalSuccess ? 'SUCCESS' : getState().status,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      );
    } catch {}

    const vlmHud = `
### Task Performance & Execution Telemetry

| Metric | Details |
| :--- | :--- |
| **Execution Time** | **${totalDuration}s** |
| **Tokens Consumed** | **~${estTokens.toLocaleString()} Tokens** (${loopCount} screenshot loops) |
| **Engine** | **UI-TARS Vision Agent** |
| **Steps Executed** | **${loopCount} visual steps** |
| **Status** | ${isFinalSuccess ? '**Verified Success**' : `**${getState().status}**`} |
`;

    // Attach HUD to final assistant message's logContent instead of polluting chat
    const currentMessages = [...(getState().messages || [])];
    if (currentMessages.length > 0) {
      const lastMsg = currentMessages[currentMessages.length - 1];
      if ((lastMsg.from === 'gpt' || (lastMsg as any).from === 'assistant')) {
        (lastMsg as any).logContent = vlmHud;
        setState({
          ...getState(),
          messages: currentMessages,
        });
      }
    }

    if (runtimeRecords.length > 0) {
      const finalRecord = runtimeRecords[runtimeRecords.length - 1];
      finalRecord.verification_result =
        isFinalSuccess ? 'VERIFIED_SUCCESS' : getState().status;
      try {
        fs.writeFileSync(
          path.join(t0RunDir, 'runtime.json'),
          JSON.stringify(runtimeRecords, null, 2),
        );
      } catch {}
    }
  } finally {
    afterAgentRun(settings.operator);
  }
};
