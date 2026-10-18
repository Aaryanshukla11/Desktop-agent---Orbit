/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 
 */
import {
  GUIAgentData,
  UITarsModelVersion,
  StatusEnum,
  ShareVersion,
  ErrorStatusEnum,
  GUIAgentError,
  Message,
} from '@UI-TARs/shared/types';
import { IMAGE_PLACEHOLDER, MAX_LOOP_COUNT } from '@UI-TARs/shared/constants';
import { sleep } from '@UI-TARs/shared/utils';
import asyncRetry from 'async-retry';
import { Jimp } from 'jimp';
import { v4 as uuidv4 } from 'uuid';

import { setContext } from './context/useContext';
import { Operator, GUIAgentConfig, InvokeParams } from './types';
import { UITarsModel } from './Model';
import { BaseGUIAgent } from './base';
import {
  getSummary,
  processVlmParams,
  replaceBase64Prefix,
  toVlmModelFormat,
} from './utils';
import {
  INTERNAL_ACTION_SPACES_ENUM,
  MAX_SNAPSHOT_ERR_CNT,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_TEMPLATE,
} from './constants';
import { InternalServerError } from 'openai';

export class GUIAgent<T extends Operator> extends BaseGUIAgent<
  GUIAgentConfig<T>
> {
  private readonly operator: T;
  private readonly model: InstanceType<typeof UITarsModel>;
  private readonly logger: NonNullable<GUIAgentConfig<T>['logger']>;
  private uiTarsVersion?: UITarsModelVersion;
  private systemPrompt: string;

  private isPaused = false;
  private resumePromise: Promise<void> | null = null;
  private resolveResume: (() => void) | null = null;
  private isStopped = false;

  constructor(config: GUIAgentConfig<T>) {
    super(config);
    this.operator = config.operator;

    this.model =
      config.model instanceof UITarsModel
        ? config.model
        : new UITarsModel(config.model);
    this.logger = config.logger || console;
    this.uiTarsVersion = config.uiTarsVersion;
    this.systemPrompt = config.systemPrompt || this.buildSystemPrompt();
  }

  async run(
    instruction: string,
    historyMessages?: Message[],
    remoteModelHdrs?: Record<string, string>,
  ) {
    const { operator, model, logger } = this;
    const {
      signal,
      onData,
      onError,
      retry = {},
      maxLoopCount = MAX_LOOP_COUNT,
    } = this.config;

    const currentTime = Date.now();
    const data: GUIAgentData = {
      version: ShareVersion.V1,
      systemPrompt: this.systemPrompt,
      instruction,
      modelName: this.model.modelName,
      status: StatusEnum.INIT,
      logTime: currentTime,
      conversations: [
        {
          from: 'human',
          value: instruction,
          timing: {
            start: currentTime,
            end: currentTime,
            cost: 0,
          },
        },
      ],
    };

    // inject guiAgent config for operator to get
    setContext(
      Object.assign(this.config, {
        logger: this.logger,
        systemPrompt: this.systemPrompt,
        factors: this.model.factors,
        model: this.model,
      }),
    );

    logger.info(
      `[GUIAgent] run:\nsystem prompt: ${this.systemPrompt},\nmodel version: ${this.uiTarsVersion},\nmodel config: ${JSON.stringify(this.model)}`,
    );

    let loopCnt = 0;
    let snapshotErrCnt = 0;
    let totalTokens = 0;
    let totalTime = 0;
    let previousResponseId: string | undefined;
    let lastActionSig = '';
    let consecutiveRepeatCount = 0;
    let consecutiveClickCount = 0;
    let recentActionHistory: string[] = [];
    let steeringHint = '';
    let lastScreenshotBase64: string | null = null;
    let visualStagnationCount = 0;

    // start running agent
    data.status = StatusEnum.RUNNING;
    await onData?.({ data: { ...data, conversations: [] } });

    // Generate session id with UUID
    const sessionId = this.generateSessionId();

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        logger.info('[GUIAgent] loopCnt:', loopCnt);
        // check pause status
        if (this.isPaused && this.resumePromise) {
          data.status = StatusEnum.PAUSE;
          await onData?.({
            data: {
              ...data,
              conversations: [],
            },
          });
          await this.resumePromise;
          data.status = StatusEnum.RUNNING;
          await onData?.({
            data: {
              ...data,
              conversations: [],
            },
          });
        }

        if (
          this.isStopped ||
          (data.status !== StatusEnum.RUNNING &&
            data.status !== StatusEnum.PAUSE) ||
          signal?.aborted
        ) {
          // check if stop or aborted
          signal?.aborted && (data.status = StatusEnum.USER_STOPPED);
          break;
        }

        if (loopCnt >= maxLoopCount) {
          Object.assign(data, {
            status: StatusEnum.ERROR,
            error: this.guiAgentErrorParser(
              ErrorStatusEnum.REACH_MAXLOOP_ERROR,
            ),
          });
          break;
        }

        if (snapshotErrCnt >= MAX_SNAPSHOT_ERR_CNT) {
          Object.assign(data, {
            status: StatusEnum.ERROR,
            error: this.guiAgentErrorParser(
              ErrorStatusEnum.SCREENSHOT_RETRY_ERROR,
            ),
          });
          break;
        }

        loopCnt += 1;
        const start = Date.now();

        const snapshot = await asyncRetry(() => operator.screenshot(), {
          retries: retry?.screenshot?.maxRetries ?? 0,
          minTimeout: 5000,
          onRetry: retry?.screenshot?.onRetry,
        });

        const { width, height, mime } = await Jimp.fromBuffer(
          Buffer.from(replaceBase64Prefix(snapshot.base64), 'base64'),
        ).catch((e) => {
          logger.error('[GUIAgent] screenshot error', e);
          return {
            width: null,
            height: null,
            mime: '',
          };
        });

        const isValidImage = !!(snapshot?.base64 && width && height);

        if (!isValidImage) {
          loopCnt -= 1;
          snapshotErrCnt += 1;
          await sleep(1000);
          continue;
        }

        let end = Date.now();

        if (isValidImage) {
          if (lastScreenshotBase64) {
            const lenDiff = Math.abs(snapshot.base64.length - lastScreenshotBase64.length);
            const isVirtuallyIdentical =
              snapshot.base64 === lastScreenshotBase64 ||
              (lenDiff < 500 && snapshot.base64.slice(1000, 5000) === lastScreenshotBase64.slice(1000, 5000));
            if (isVirtuallyIdentical) {
              visualStagnationCount++;
              logger.warn(
                `[GUIAgent] CLOSED-LOOP: Visual stagnation detected (${visualStagnationCount}x consecutive identical screen state)`,
              );
            } else {
              visualStagnationCount = 0;
            }
          }
          lastScreenshotBase64 = snapshot.base64;

          data.conversations.push({
            from: 'human',
            value: IMAGE_PLACEHOLDER,
            screenshotBase64: snapshot.base64,
            screenshotContext: {
              size: {
                width,
                height,
              },
              mime,
              scaleFactor: snapshot.scaleFactor,
            },
            timing: {
              start,
              end,
              cost: end - start,
            },
          });
          await onData?.({
            data: {
              ...data,
              conversations: data.conversations.slice(-1),
            },
          });
        }

        let effectiveSystemPrompt = data.systemPrompt;
        if (steeringHint) {
          effectiveSystemPrompt += `\n\n${steeringHint}`;
          const lastHuman = [...data.conversations].reverse().find((c) => c.from === 'human');
          if (lastHuman && !lastHuman.value.includes('[ALERT]') && !lastHuman.value.includes('[CLOSED-LOOP') && !lastHuman.value.includes('[CRITICAL')) {
            lastHuman.value = `${lastHuman.value}\n\n${steeringHint}`;
          }
        }

        // conversations -> messages, images
        const modelFormat = toVlmModelFormat({
          historyMessages: historyMessages || [],
          conversations: data.conversations,
          systemPrompt: effectiveSystemPrompt,
        });
        // sliding images window to vlm model (keep only latest screenshot to maintain sub-2s latency)
        const vlmParams: InvokeParams = {
          ...processVlmParams(modelFormat.conversations, modelFormat.images, 1),
          screenContext: {
            width,
            height,
          },
          scaleFactor: snapshot.scaleFactor,
          uiTarsVersion: this.uiTarsVersion,
          headers: {
            ...remoteModelHdrs,
            'X-Session-Id': sessionId,
          },
          previousResponseId,
        };
        const {
          prediction,
          parsedPredictions,
          costTime,
          costTokens,
          responseId,
        } = await asyncRetry(
          async (bail) => {
            try {
              const result = await model.invoke(vlmParams);
              return result;
            } catch (error: unknown) {
              if (
                error instanceof Error &&
                (error?.name === 'APIUserAbortError' ||
                  error?.message?.includes('aborted') ||
                  error?.message?.includes('401') ||
                  error?.message?.includes('403') ||
                  error?.message?.includes('API key') ||
                  error?.message?.includes('invalidated') ||
                  error?.message?.includes('expired') ||
                  error?.message?.includes('quota'))
              ) {
                bail(error as unknown as Error);
                return {
                  prediction: '',
                  parsedPredictions: [],
                };
              }

              Object.assign(data, {
                status: StatusEnum.ERROR,
                error: this.guiAgentErrorParser(
                  ErrorStatusEnum.INVOKE_RETRY_ERROR,
                  error as Error,
                ),
              });
              throw error;
            }
          },
          {
            retries: retry?.model?.maxRetries ?? 0,
            minTimeout: 1000 * 30,
            onRetry: retry?.model?.onRetry,
          },
        );

        // responseId shouldn't be assigned to null or undefined
        if (responseId) {
          previousResponseId = responseId;
        }

        totalTokens += costTokens || 0;
        totalTime += costTime || 0;

        logger.info(
          `[GUIAgent] consumes: >>> costTime: ${costTime}, costTokens: ${costTokens} <<<`,
        );
        logger.info('[GUIAgent] Response:', prediction);
        logger.info(
          '[GUIAgent] Parsed Predictions:',
          JSON.stringify(parsedPredictions),
        );

        if (!prediction) {
          logger.error('[GUIAgent] Response Empty:', prediction);
          continue;
        }

        const predictionSummary = getSummary(prediction);

        end = Date.now();
        data.conversations.push({
          from: 'gpt',
          value: predictionSummary,
          timing: {
            start,
            end,
            cost: end - start,
          },
          screenshotContext: {
            size: {
              width,
              height,
            },
            scaleFactor: snapshot.scaleFactor,
          },
          predictionParsed: parsedPredictions,
        });
        await onData?.({
          data: {
            ...data,
            conversations: data.conversations.slice(-1),
          },
        });

        // start execute action
        for (const parsedPrediction of parsedPredictions) {
          const actionType = (parsedPrediction.action_type || '').trim();

          logger.info('[GUIAgent] Action:', actionType);

          if (!actionType) {
            const thoughtText = parsedPrediction.thought || '';
            logger.warn('[GUIAgent] Received empty action from model prediction. Thought:', thoughtText);
            if (
              /\b(?:task\s+(?:is\s+)?complete|completed\s+the\s+task|finished|done|all\s+(?:rows|data|steps)\s+(?:are|have\s+been)\s+(?:added|created|saved))\b/i.test(
                thoughtText,
              )
            ) {
              logger.info('[GUIAgent] Empty action with completion thought detected, finalizing task.');
              data.status = StatusEnum.END;
              break;
            }
            steeringHint = `[SYSTEM NOTICE]: Your previous turn contained thoughts but NO executable action. You MUST end your response with a valid Action:
Action: click(start_box='[x1, y1, x2, y2]')
Action: type(content='...')
Action: hotkey(key='...')
Action: finished()`;
            continue;
          }

          const isClickAction = ['click', 'left_double', 'right_single'].includes(actionType);
          if (isClickAction) {
            consecutiveClickCount++;
          } else {
            consecutiveClickCount = 0;
          }

          // Action repetition & loop detector
          const currentSig = `${actionType}::${JSON.stringify(parsedPrediction.action_inputs || {})}`;
          recentActionHistory.push(currentSig);
          if (recentActionHistory.length > 8) {
            recentActionHistory.shift();
          }
          const historyMatches = recentActionHistory.filter((s) => s === currentSig).length;

          if (currentSig === lastActionSig) {
            consecutiveRepeatCount++;
          } else {
            lastActionSig = currentSig;
            consecutiveRepeatCount = 1;
            if (historyMatches < 3 && consecutiveClickCount < 3) {
              steeringHint = '';
            }
          }

          if (visualStagnationCount >= 2) {
            steeringHint = `[CLOSED-LOOP VERIFICATION ALERT]: Screen did NOT change after the previous action! The previous action had ZERO effect. The window or input control is NOT focused, or the coordinates missed.
1. If navigating to a URL or searching: use hotkey(key='ctrl l') to focus the address bar, then type the URL.
2. If clicking an element that didn't respond: do NOT repeat the same click! Use keyboard shortcuts or click inside the window content.
3. If an app window is unmaximized, maximize it immediately with hotkey(key='win up').`;
          }

          if (
            visualStagnationCount >= 3 ||
            (consecutiveClickCount >= 4 && visualStagnationCount >= 1) ||
            consecutiveRepeatCount >= 4 ||
            historyMatches >= 4
          ) {
            logger.warn(
              `[GUIAgent] CLOSED-LOOP CIRCUIT BREAKER: Stagnant screen or loop detected (${visualStagnationCount}x stagnant / ${consecutiveRepeatCount}x repeat / ${historyMatches}x history matches). Executing active rescue.`,
            );
            try {
              const thoughtText = parsedPrediction.thought || '';
              const wasNavIntent =
                (actionType === 'type' &&
                  /\b(?:https?:|\.com|\.org|\.net|canva\.com)\b/i.test(
                    JSON.stringify(parsedPrediction.action_inputs || {}),
                  )) ||
                /\b(?:address\s*bar|url\s*bar|omnibox|browser\s*address)\b/i.test(thoughtText);
              const wasModalOrMenuIntent =
                /\b(?:share|menu|drawer|download|export|modal|dialog|popup|overlay|see all|crop)\b/i.test(thoughtText);

              const typeIntentMatch = thoughtText.match(/\b(?:type|search\s+for|enter|input)\s+["']([^"']{1,50}?)["']/i);
              const isMessagesIntent = /\b(?:messages?|chat|direct|dm|inbox)\b/i.test(thoughtText);

              if (typeIntentMatch && typeIntentMatch[1]) {
                const targetWord = typeIntentMatch[1].split('/')[0].trim();
                logger.info(
                  `[GUIAgent] Circuit breaker: Thought-Action desynchronization detected for "${targetWord}", steering model to type()`,
                );
                steeringHint = `[CRITICAL RECOVERY]: You are in a repetitive click loop! Your thought stated you want to type/search "${targetWord}".
You MUST NOT output click() again! You MUST output Action: type(content='${targetWord}\\n') immediately!`;
              } else if (isMessagesIntent) {
                logger.info('[GUIAgent] Circuit breaker: repetitive click on Messages detected, steering to direct navigation');
                steeringHint = `[CRITICAL RECOVERY]: You are in a repetitive click loop trying to open Messages!
Do NOT click the bottom corner. In web apps like Instagram, navigate directly:
Action: hotkey(key='ctrl l')
followed by:
Action: type(content='instagram.com/direct/\\n')
Or click the left sidebar Messenger icon at [25, 410, 25, 410]!`;
              } else if (wasModalOrMenuIntent || isClickAction) {
                logger.info(
                  '[GUIAgent] Circuit breaker: dismissing blocking menu/drawer/modal/crop via Esc',
                );
                await operator.execute({
                  prediction: '',
                  parsedPrediction: {
                    thought: 'Circuit breaker: dismissing blocking modal via Esc',
                    reflection: null,
                    action_type: 'hotkey',
                    action_inputs: { key: 'esc' },
                  },
                  screenWidth: width,
                  screenHeight: height,
                  scaleFactor: snapshot.scaleFactor,
                  factors: this.model.factors,
                });
                steeringHint = `[CLOSED-LOOP RESCUE]: Actions were stagnant or looping. An Esc key was sent to reset focus.
1. Do NOT repeat the same click! If clicking failed, change coordinates or use keyboard shortcuts.
2. If your task is completed, call finished().`;
              } else if (wasNavIntent) {
                logger.info(
                  '[GUIAgent] Circuit breaker: forcing address bar focus via Ctrl+L',
                );
                await operator.execute({
                  prediction: '',
                  parsedPrediction: {
                    thought: 'Circuit breaker: focusing address bar',
                    reflection: null,
                    action_type: 'hotkey',
                    action_inputs: { key: 'ctrl l' },
                  },
                  screenWidth: width,
                  screenHeight: height,
                  scaleFactor: snapshot.scaleFactor,
                  factors: this.model.factors,
                });
              } else {
                logger.info(
                  '[GUIAgent] Circuit breaker: maximizing active window',
                );
                await operator.execute({
                  prediction: '',
                  parsedPrediction: {
                    thought: 'Circuit breaker: maximizing active window',
                    reflection: null,
                    action_type: 'hotkey',
                    action_inputs: { key: 'win up' },
                  },
                  screenWidth: width,
                  screenHeight: height,
                  scaleFactor: snapshot.scaleFactor,
                  factors: this.model.factors,
                });
              }

              // Prune duplicate consecutive assistant responses from conversation history to break autoregressive token repetition
              const cleanedConversations = [];
              let prevValue = '';
              for (const c of data.conversations) {
                if (c.from === 'gpt' && c.value === prevValue) {
                  continue; // Skip duplicate repetitive assistant turn
                }
                prevValue = c.value;
                cleanedConversations.push(c);
              }
              data.conversations = cleanedConversations;
            } catch (e) {}
            visualStagnationCount = 0;
            consecutiveClickCount = 0;
            consecutiveRepeatCount = 0;
            lastActionSig = '';
            recentActionHistory = [];
          }

          // handle internal action spaces
          if (actionType === INTERNAL_ACTION_SPACES_ENUM.ERROR_ENV) {
            Object.assign(data, {
              status: StatusEnum.ERROR,
              error: this.guiAgentErrorParser(
                ErrorStatusEnum.ENVIRONMENT_ERROR,
              ),
            });
            break;
          } else if (actionType === INTERNAL_ACTION_SPACES_ENUM.MAX_LOOP) {
            Object.assign(data, {
              status: StatusEnum.ERROR,
              error: this.guiAgentErrorParser(
                ErrorStatusEnum.REACH_MAXLOOP_ERROR,
              ),
            });
            break;
          }

          if (!signal?.aborted && !this.isStopped) {
            logger.info(
              '[GUIAgent] Action Inputs:',
              parsedPrediction.action_inputs,
              parsedPrediction.action_type,
            );
            // TODO: pass executeOutput to onData
            const executeOutput = await asyncRetry(
              () =>
                operator.execute({
                  prediction,
                  parsedPrediction,
                  screenWidth: width,
                  screenHeight: height,
                  scaleFactor: snapshot.scaleFactor,
                  factors: this.model.factors,
                }),
              {
                retries: retry?.execute?.maxRetries ?? 0,
                minTimeout: 5000,
                onRetry: retry?.execute?.onRetry,
              },
            ).catch((e) => {
              logger.error('[GUIAgent] execute error', e);
              Object.assign(data, {
                status: StatusEnum.ERROR,
                error: this.guiAgentErrorParser(
                  ErrorStatusEnum.EXECUTE_RETRY_ERROR,
                  e,
                ),
              });
            });

            if (executeOutput && executeOutput?.status) {
              data.status = executeOutput.status;
            }
          }

          // Action types must break the loop after operator execution:
          if (actionType === INTERNAL_ACTION_SPACES_ENUM.CALL_USER) {
            data.status = StatusEnum.CALL_USER;
            break;
          } else if (actionType === INTERNAL_ACTION_SPACES_ENUM.FINISHED) {
            data.status = StatusEnum.END;
            break;
          }
        }

        if (this.config.loopIntervalInMs && this.config.loopIntervalInMs > 0) {
          logger.info(
            `[GUIAgent] sleep for ${this.config.loopIntervalInMs}ms before next loop`,
          );
          await sleep(this.config.loopIntervalInMs);
          logger.info(
            `[GUIAgent] sleep for ${this.config.loopIntervalInMs}ms before next loop done`,
          );
        }
      }
    } catch (error) {
      logger.error('[GUIAgent] Catch error', error);
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message?.includes('aborted'))
      ) {
        logger.info('[GUIAgent] Catch: request was aborted');
        data.status = StatusEnum.USER_STOPPED;
        return;
      }

      data.status = StatusEnum.ERROR;
      data.error = this.guiAgentErrorParser(
        ErrorStatusEnum.UNKNOWN_ERROR,
        error as Error,
      );

      // We only use OnError callback to dispatch error information to caller,
      // and we will not throw error to the caller.
      // throw error;
    } finally {
      logger.info('[GUIAgent] Finally: status', data.status);

      this.model?.reset();

      if (data.status === StatusEnum.USER_STOPPED) {
        await operator.execute({
          prediction: '',
          parsedPrediction: {
            action_inputs: {},
            reflection: null,
            action_type: 'user_stop',
            thought: '',
          },
          screenWidth: 0,
          screenHeight: 0,
          scaleFactor: 1,
          factors: [0, 0],
        });
      }

      await onData?.({ data: { ...data, conversations: [] } });

      if (data.status === StatusEnum.ERROR) {
        onError?.({
          data,
          error:
            data.error ||
            new GUIAgentError(
              ErrorStatusEnum.UNKNOWN_ERROR,
              'Unknown error occurred',
            ),
        });
      }

      logger.info(
        `[GUIAgent] >>> totalTokens: ${totalTokens}, totalTime: ${totalTime}, loopCnt: ${loopCnt} <<<`,
      );
    }
  }

  public pause() {
    this.isPaused = true;
    this.resumePromise = new Promise((resolve) => {
      this.resolveResume = resolve;
    });
  }

  public resume() {
    if (this.resolveResume) {
      this.resolveResume();
      this.resumePromise = null;
      this.resolveResume = null;
    }
    this.isPaused = false;
  }

  public stop() {
    this.isStopped = true;
  }

  private buildSystemPrompt() {
    const actionSpaces = (this.operator.constructor as typeof Operator)?.MANUAL
      ?.ACTION_SPACES;

    return actionSpaces == null || actionSpaces.length === 0
      ? SYSTEM_PROMPT
      : SYSTEM_PROMPT_TEMPLATE.replace(
          '{{action_spaces_holder}}',
          actionSpaces.join('\n'),
        );
  }

  private guiAgentErrorParser(
    type: ErrorStatusEnum,
    error?: Error,
  ): GUIAgentError {
    this.logger.error('[GUIAgent] guiAgentErrorParser:', error);

    let parseError = null;

    if (error instanceof InternalServerError) {
      this.logger.error(
        '[GUIAgent] guiAgentErrorParser instanceof InternalServerError.',
      );
      parseError = new GUIAgentError(
        ErrorStatusEnum.MODEL_SERVICE_ERROR,
        error.message,
        error.stack,
      );
    }

    if (!parseError && type === ErrorStatusEnum.REACH_MAXLOOP_ERROR) {
      parseError = new GUIAgentError(
        ErrorStatusEnum.REACH_MAXLOOP_ERROR,
        `Has reached max loop count: ${error?.message || ''}`,
        error?.stack,
      );
    }

    if (!parseError && type === ErrorStatusEnum.SCREENSHOT_RETRY_ERROR) {
      parseError = new GUIAgentError(
        ErrorStatusEnum.SCREENSHOT_RETRY_ERROR,
        `Too many screenshot failures: ${error?.message || ''}`,
        error?.stack,
      );
    }

    if (!parseError && type === ErrorStatusEnum.INVOKE_RETRY_ERROR) {
      parseError = new GUIAgentError(
        ErrorStatusEnum.INVOKE_RETRY_ERROR,
        `Too many model invoke failures: ${error?.message || ''}`,
        error?.stack,
      );
    }

    if (!parseError && type === ErrorStatusEnum.EXECUTE_RETRY_ERROR) {
      parseError = new GUIAgentError(
        ErrorStatusEnum.EXECUTE_RETRY_ERROR,
        `Too many action execute failures: ${error?.message || ''}`,
        error?.stack,
      );
    }

    if (!parseError && type === ErrorStatusEnum.ENVIRONMENT_ERROR) {
      parseError = new GUIAgentError(
        ErrorStatusEnum.ENVIRONMENT_ERROR,
        `The environment error occurred when parsing the action: ${error?.message || ''}`,
        error?.stack,
      );
    }

    if (!parseError) {
      parseError = new GUIAgentError(
        ErrorStatusEnum.UNKNOWN_ERROR,
        error instanceof Error ? error.message : 'Unknown error occurred',
        error instanceof Error ? error.stack || 'null' : 'null',
      );
    }

    if (!parseError.stack) {
      // Avoid guiAgentErrorParser it self in stack trace
      Error.captureStackTrace(parseError, this.guiAgentErrorParser);
    }

    return parseError;
  }

  private generateSessionId(): string {
    return uuidv4();
  }
}
