/**
 
 */
import { useState } from 'react';
import { AlertCircle, Camera, ChevronDown, Loader2 } from 'lucide-react';
import { ErrorStatusEnum } from '@UI-TARs/shared/types';

import { Button } from '@renderer/components/ui/button';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@renderer/components/ui/alert';
import { Markdown } from '../markdown';

export const HumanTextMessage = ({ text }: { text: string }) => {
  return (
    <div className="flex gap-2 my-4 ml-4 items-center">
      <div className="ml-auto px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-white/15 dark:text-slate-100 border border-slate-800 dark:border-white/20 backdrop-blur-md shadow-md text-sm leading-relaxed max-w-[85%] break-words font-medium select-text">
        {text}
      </div>
    </div>
  );
};

export const AssistantTextMessage = ({ text }: { text: string }) => {
  return (
    <div className="flex gap-2 mb-4 items-center">
      <div className="mr-auto px-4 py-3 rounded-2xl bg-black/[0.04] text-slate-900 dark:bg-white/5 dark:text-slate-200 border border-black/10 dark:border-white/10 backdrop-blur-md shadow-sm text-sm leading-relaxed max-w-[85%] break-words select-text">
        <Markdown>{text.replace(/\\n/g, '\n')}</Markdown>
      </div>
    </div>
  );
};

interface ScreenshotMessageProps {
  onClick?: () => void;
}

export const ScreenshotMessage = ({ onClick }: ScreenshotMessageProps) => {
  return (
    <Button
      variant="outline"
      size="sm"
      className="orbit-glass-button rounded-full text-xs px-3 py-1 gap-1.5 text-slate-800 dark:text-slate-200 font-medium border-slate-300 dark:border-white/15 shadow-sm"
      onClick={onClick}
    >
      <Camera className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
      <span>Screenshot</span>
    </Button>
  );
};

const getError = (text: string) => {
  let error: { message: string; stack: string };
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.status) {
      const errorStatus = ErrorStatusEnum[parsed.status] || 'Error';
      error = {
        message: `${errorStatus}: ${parsed.message}`,
        stack: parsed.stack || text,
      };
    } else {
      error = {
        message: `Error: ${parsed.message || ''}`,
        stack: parsed.stack || text,
      };
    }
  } catch (e) {
    error = {
      message: 'Error:',
      stack: text,
    };
  }

  return error;
};

export const ErrorMessage = ({ text }: { text: string }) => {
  const error = getError(text);
  const [isExpanded, setIsExpanded] = useState(false);

  const MAX_LINE = 2;
  const stackLines = error.stack.split('\n') || [];
  const hasMoreLines = stackLines.length > MAX_LINE;
  const displayedStack = isExpanded
    ? error.stack
    : stackLines.slice(0, MAX_LINE).join('\n');

  return (
    <Alert variant="destructive" className="my-4 border-destructive/50">
      <AlertCircle />
      <AlertTitle className="break-all">{error.message}</AlertTitle>
      <AlertDescription className="break-all whitespace-pre-wrap">
        {displayedStack}
        {hasMoreLines && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 bottom-2 w-7 h-7 cursor-pointer hover:bg-red-50 hover:text-red-500"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown className={isExpanded ? 'rotate-180' : ''} />
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export const LoadingText = ({ text }: { text: string }) => {
  return (
    <div className="mt-4">
      <div className="inline-flex items-center gap-2 text-muted-foreground animate-pulse">
        <Loader2 className="h-4 w-4 animate-spin" />
        {text}
      </div>
    </div>
  );
};
