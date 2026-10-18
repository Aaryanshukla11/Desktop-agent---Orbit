/*
 
 */
import { initIpc } from '@UI-TARs/electron-ipc/main';
import { StatusEnum, Conversation, Message } from '@UI-TARs/shared/types';
import { store } from '@main/store/create';
import { runAgent } from '@main/services/runAgent';
import { showWindow } from '@main/window/index';
import { logger } from '@main/logger';

import { closeScreenMarker } from '@main/window/ScreenMarker';
import { GUIAgent } from '@UI-TARs/sdk';
import { Operator } from '@UI-TARs/sdk/core';

const t = initIpc.create();

export class GUIAgentManager {
  private static instance: GUIAgentManager;
  private currentAgent: GUIAgent<Operator> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): GUIAgentManager {
    if (!GUIAgentManager.instance) {
      GUIAgentManager.instance = new GUIAgentManager();
    }
    return GUIAgentManager.instance;
  }

  public setAgent(agent: GUIAgent<Operator>) {
    this.currentAgent = agent;
  }

  public getAgent(): GUIAgent<Operator> | null {
    return this.currentAgent;
  }

  public clearAgent() {
    this.currentAgent = null;
  }
}

export const agentRoute = t.router({
  runAgent: t.procedure.input<void>().handle(async () => {
    const { thinking } = store.getState();
    if (thinking) {
      logger.warn('[agentRoute.runAgent] Already in thinking state; clearing stale state and proceeding');
    }

    store.setState({
      abortController: new AbortController(),
      thinking: true,
      errorMsg: null,
    });

    try {
      await runAgent(store.setState, store.getState);
    } catch (err: any) {
      logger.error('[agentRoute.runAgent] Unhandled error during agent execution:', err);
      store.setState({
        status: StatusEnum.ERROR,
        
        errorMsg: err?.message || String(err),
      });
    } finally {
      store.setState({ thinking: false });
    }
  }),
  pauseRun: t.procedure.input<void>().handle(async () => {
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.pause();
      store.setState({ thinking: false });
    }
  }),
  resumeRun: t.procedure.input<void>().handle(async () => {
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.resume();
      store.setState({ thinking: false });
    }
  }),
  stopRun: t.procedure.input<void>().handle(async () => {
    const { abortController } = store.getState();
    store.setState({ status: StatusEnum.END, thinking: false });

    showWindow();

    abortController?.abort();
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.resume();
      guiAgent.stop();
    }

    closeScreenMarker();
  }),
  setInstructions: t.procedure
    .input<{ instructions: string }>()
    .handle(async ({ input }) => {
      store.setState({ instructions: input.instructions });
    }),
  setMessages: t.procedure
    .input<{ messages: Conversation[] }>()
    .handle(async ({ input }) => {
      store.setState({ messages: input.messages });
    }),
  setSessionHistoryMessages: t.procedure
    .input<{ messages: Message[] }>()
    .handle(async ({ input }) => {
      store.setState({ sessionHistoryMessages: input.messages });
    }),
  clearHistory: t.procedure.input<void>().handle(async () => {
    store.setState({
      status: StatusEnum.END,
      messages: [],
      thinking: false,
      errorMsg: null,
      instructions: '',
    });
  }),
  getExperienceStats: t.procedure.input<void>().handle(async () => {
    const { OrbitExperienceEngine } = await import('@main/services/experienceEngine');
    return OrbitExperienceEngine.getInstance().getStats();
  }),
  getExperienceGuidance: t.procedure
    .input<{ instruction: string }>()
    .handle(async ({ input }) => {
      const { OrbitExperienceEngine } = await import('@main/services/experienceEngine');
      return OrbitExperienceEngine.getInstance().getGuidanceForTask(input.instruction);
    }),
  getMacrosList: t.procedure.input<void>().handle(async () => {
    const { OrbitMacroEngine } = await import('@main/services/macroEngine');
    return OrbitMacroEngine.getInstance().getMacrosList();
  }),
});
