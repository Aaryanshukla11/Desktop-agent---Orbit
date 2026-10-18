import { MessageCirclePlus, ScrollText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TaskLogDialog } from '@renderer/components/TaskLogDialog';

import { Card } from '@renderer/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@renderer/components/ui/tabs';
import { Button } from '@renderer/components/ui/button';
import { SidebarTrigger, useSidebar } from '@renderer/components/ui/sidebar';
import { NavHeader } from '@renderer/components/Detail/NavHeader';
import { ScrollArea } from '@renderer/components/ui/scroll-area';

import { useStore } from '@renderer/hooks/useStore';
import { useSession } from '@renderer/hooks/useSession';
import Prompts from '../../components/Prompts';
import { IMAGE_PLACEHOLDER } from '@UI-TARs/shared/constants';
import {
  AssistantTextMessage,
  ErrorMessage,
  HumanTextMessage,
  LoadingText,
  ScreenshotMessage,
} from '../../components/RunMessages/Messages';
import ThoughtChain from '../../components/ThoughtChain';
import { api } from '../../api';
import ImageGallery from '../../components/ImageGallery';
import { PredictionParsed, StatusEnum } from '@UI-TARs/shared/types';
import { RouterState } from '../../typings';
import ChatInput from '../../components/ChatInput';
import { NavDialog } from '../../components/AlertDialog/navDialog';
import {
  checkVLMSettings,
  LocalSettingsDialog,
} from '../../components/Settings/local';
import { sleep } from '@UI-TARs/shared/utils';

const getFinishedContent = (predictionParsed?: PredictionParsed[]) =>
  predictionParsed?.find(
    (step) =>
      step.action_type === 'finished' &&
      typeof step.action_inputs?.content === 'string' &&
      step.action_inputs.content.trim() !== '',
  )?.action_inputs?.content as string | undefined;

const LocalOperator = () => {
  const state = useLocation().state as RouterState;
  const navigate = useNavigate();
  const { setOpen } = useSidebar();

  const { status, messages = [], thinking, errorMsg } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestions: string[] = [];
  const [selectImg, setSelectImg] = useState<number | undefined>(undefined);
  const [initId, setInitId] = useState('');
  const {
    currentSessionId,
    setActiveSession,
    updateMessages,
    createSession,
    chatMessages,
  } = useSession();
  const [pendingAction, setPendingAction] = useState<'newChat' | 'back' | null>(
    null,
  );
  const [isNavDialogOpen, setNavDialogOpen] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);

  useEffect(() => {
    const update = async () => {
      if (state.sessionId) {
        await setActiveSession(state.sessionId);
        setInitId(state.sessionId);
      }
    };
    update();
    setOpen(false);
  }, [state.sessionId]);

  useEffect(() => {
    if (initId !== state.sessionId) {
      return;
    }

    if (
      state.sessionId &&
      currentSessionId &&
      state.sessionId !== currentSessionId
    ) {
      return;
    }

    if (messages.length) {
      const existingMessagesSet = new Set(
        chatMessages.map(
          (msg) => `${msg.value}-${msg.from}-${msg.timing?.start}`,
        ),
      );
      const newMessages = messages.filter(
        (msg) =>
          !existingMessagesSet.has(
            `${msg.value}-${msg.from}-${msg.timing?.start}`,
          ),
      );
      const allMessages = [...chatMessages, ...newMessages];

      updateMessages(state.sessionId, allMessages);
    }
  }, [
    initId,
    state.sessionId,
    currentSessionId,
    chatMessages.length,
    messages.length,
  ]);

  useEffect(() => {
    setTimeout(() => {
      containerRef.current?.scrollIntoView(false);
    }, 100);
  }, [messages, thinking, errorMsg]);

  const handleSelect = async (suggestion: string) => {
    await api.setInstructions({ instructions: suggestion });
  };

  const handleImageSelect = async (index: number) => {
    setSelectImg(index);
  };

  // check status before nav
  const needsConfirm =
    status === StatusEnum.RUNNING ||
    status === StatusEnum.CALL_USER ||
    status === StatusEnum.PAUSE;

  const onNewChat = useCallback(async () => {
    const session = await createSession('New Session', {
      operator: state.operator,
    });

    navigate('/local', {
      state: {
        operator: state.operator,
        sessionId: session?.id,
        from: 'new',
      },
    });
  }, []);

  const onBack = useCallback(async () => {
    navigate('/');
  }, []);

  const handleNewChat = useCallback(() => {
    if (needsConfirm) {
      setPendingAction('newChat');
      setNavDialogOpen(true);
    } else {
      onNewChat();
    }
  }, [needsConfirm]);

  const handleBack = useCallback(() => {
    if (needsConfirm) {
      setPendingAction('back');
      setNavDialogOpen(true);
    } else {
      onBack();
    }
  }, [needsConfirm]);

  const onConfirm = useCallback(async () => {
    await api.stopRun();
    await api.clearHistory();

    if (pendingAction === 'newChat') {
      await onNewChat();
    } else if (pendingAction === 'back') {
      await onBack();
    }
    setPendingAction(null);
    setNavDialogOpen(false);
  }, [pendingAction]);

  const onCancel = useCallback(() => {
    setPendingAction(null);
    setNavDialogOpen(false);
  }, []);

  const handleLocalSettingsSubmit = async () => {
    setLocalOpen(false);

    await sleep(200);
  };

  const handleLocalSettingsClose = () => {
    setLocalOpen(false);
  };

  const checkVLM = async () => {
    const hasVLM = await checkVLMSettings();

    if (hasVLM) {
      return true;
    } else {
      setLocalOpen(true);
      return false;
    }
  };

  const renderChatList = () => {
    return (
      <ScrollArea className="h-full px-4">
        <div ref={containerRef}>
          {!chatMessages?.length && suggestions?.length > 0 && (
            <Prompts suggestions={suggestions} onSelect={handleSelect} />
          )}

          {chatMessages?.map((message, idx) => {
            if (message?.from === 'human') {
              if (message?.value === IMAGE_PLACEHOLDER) {
                // screen shot
                return (
                  <ScreenshotMessage
                    key={`message-${idx}`}
                    onClick={() => handleImageSelect(idx)}
                  />
                );
              }

              return (
                <HumanTextMessage
                  key={`message-${idx}`}
                  text={message?.value}
                />
              );
            }

            const { predictionParsed, screenshotBase64WithElementMarker } =
              message;

            // Find the finished step (VL 1.5 Model)
            const finishedStep = getFinishedContent(predictionParsed);

            return (
              <div key={idx}>
                {predictionParsed?.length ? (
                  <ThoughtChain
                    steps={predictionParsed}
                    hasSomImage={!!screenshotBase64WithElementMarker}
                    onClick={() => handleImageSelect(idx)}
                  />
                ) : null}

                {!!finishedStep && <AssistantTextMessage text={finishedStep} />}
              </div>
            );
          })}

          {thinking && <LoadingText text={'Thinking...'} />}
          {errorMsg && <ErrorMessage text={errorMsg} />}
        </div>
      </ScrollArea>
    );
  };

  // Extract latest finished content or logs
  const latestFinishedMsg = chatMessages
    ?.slice()
    .reverse()
    .find((m) => {
      const finished = getFinishedContent(m.predictionParsed);
      return !!finished || (m.from === 'gpt' && typeof m.value === 'string' && m.value.length > 30);
    });

  const latestLogContent =
    (latestFinishedMsg as any)?.logContent ||
    getFinishedContent(latestFinishedMsg?.predictionParsed) ||
    (latestFinishedMsg?.value as string) ||
    '';

  const allThoughtSteps = chatMessages
    ?.flatMap((m) => m.predictionParsed || [])
    .filter((step) => step.action_type === 'thought');

  return (
    <div className="flex flex-col w-full h-full">
      <NavHeader
        title={state.operator}
        onBack={handleBack}
      ></NavHeader>
      <div className="px-5 pb-5 flex flex-1 gap-5">
        <Card className="flex-1 basis-2/5 px-0 py-4 gap-4 h-[calc(100vh-76px)] orbit-glass-card rounded-2xl border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between w-full px-4">
            <SidebarTrigger
              variant="secondary"
              className="size-8 orbit-glass-button rounded-lg text-slate-600 dark:text-slate-300"
            ></SidebarTrigger>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="orbit-glass-button rounded-xl text-xs gap-1.5 border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => setLogDialogOpen(true)}
              >
                <ScrollText className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                Log
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="orbit-glass-button rounded-xl text-xs gap-1.5 border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10"
                onClick={handleNewChat}
              >
                <MessageCirclePlus className="w-3.5 h-3.5" />
                New Chat
              </Button>
            </div>
          </div>
          {renderChatList()}
          <ChatInput
            disabled={false}
            operator={state.operator}
            sessionId={state.sessionId}
            checkBeforeRun={checkVLM}
          />
        </Card>
        <Card className="flex-1 basis-3/5 p-4 h-[calc(100vh-76px)] orbit-glass-card rounded-2xl border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100 shadow-xl overflow-hidden">
          <Tabs defaultValue="screenshot" className="flex-1 flex flex-col h-full">
            <TabsList className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl self-start p-1">
              <TabsTrigger
                value="screenshot"
                className="rounded-lg data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/15 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-slate-600 dark:text-slate-300 text-xs px-3"
              >
                ScreenShot
              </TabsTrigger>
            </TabsList>
            <TabsContent value="screenshot" className="flex-1 overflow-hidden mt-3">
              <ImageGallery
                messages={chatMessages}
                selectImgIndex={selectImg}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      <NavDialog
        open={isNavDialogOpen}
        onOpenChange={onCancel}
        onConfirm={onConfirm}
      />
      <LocalSettingsDialog
        isOpen={localOpen}
        onSubmit={handleLocalSettingsSubmit}
        onClose={handleLocalSettingsClose}
      />
      <TaskLogDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        rawLogContent={latestLogContent}
        thoughtSteps={allThoughtSteps}
      />
    </div>
  );
};

export default LocalOperator;
