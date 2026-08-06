/**
 
 */
import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';

import { logger } from '@main/logger';
import { StatusEnum, UITarsModelVersion } from '@ui-tars/shared/types';
import { type ConversationWithSoM } from '@main/shared/types';
import { GUIAgent, type GUIAgentConfig } from '@ui-tars/sdk';
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
} from '@ui-tars/operator-browser';
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
import { UITarsModelConfig } from '@ui-tars/sdk/core';

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

  let screenshotIndex = 0;
  const runtimeRecords: any[] = [];
  let lastActionName = 'initial';

  const handleData: GUIAgentConfig<NutJSElectronOperator>['onData'] = async ({
    data,
  }) => {
    const lastConv = getState().messages[getState().messages.length - 1];
    const { status, conversations, ...restUserData } = data;
    logger.info('[onGUIAgentData] status', status, conversations.length);

    // T0 evidence capture
    for (const conv of conversations) {
      if (conv.screenshotBase64) {
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
          runtimeRecords.push({
            loop: Math.max(0, screenshotIndex - 1),
            vlm_raw_response: conv.value,
            parsed_action: pred,
            normalized_coordinates: normCoords,
            actual_screen_coordinates: NutJSElectronOperator.lastCoords,
            action_execution_result: status,
            screenshot_timestamp: new Date().toISOString(),
            verification_result: status === StatusEnum.END ? 'TASK_COMPLETED' : 'IN_PROGRESS',
          });
          try {
            fs.writeFileSync(
              path.join(t0RunDir, 'runtime.json'),
              JSON.stringify(runtimeRecords, null, 2),
            );
          } catch (err) {
            logger.error('[T0 Evidence] error writing runtime.json:', err);
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

  const systemPrompt = getSpByModelVersion(
    modelVersion,
    language,
    operatorType,
  );

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

  logger.info('[runAgent Totoal cost]: ', (Date.now() - startTime) / 1000, 's');

  if (runtimeRecords.length > 0) {
    const finalRecord = runtimeRecords[runtimeRecords.length - 1];
    finalRecord.verification_result =
      getState().status === StatusEnum.END ? 'VERIFIED_SUCCESS' : getState().status;
    try {
      fs.writeFileSync(
        path.join(t0RunDir, 'runtime.json'),
        JSON.stringify(runtimeRecords, null, 2),
      );
    } catch {}
  }

  afterAgentRun(settings.operator);
};
