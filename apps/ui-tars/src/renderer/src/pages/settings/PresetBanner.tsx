/**
 
 */
import { Info } from 'lucide-react';

import { Card } from '@renderer/components/ui/card';
import { Button } from '@renderer/components/ui/button';
import {
  Tooltip as CNTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@renderer/components/ui/tooltip';

interface PresetBannerProps {
  url?: string;
  date?: number;
  handleUpdatePreset: (e: React.MouseEvent) => void;
  handleResetPreset: (e: React.MouseEvent) => void;
}

export function PresetBanner(props: PresetBannerProps) {
  return (
    <Card className="p-4 mb-4 orbit-glass-card rounded-2xl border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-200">
            Remote Preset Management
          </span>
          <TooltipProvider>
            <CNTooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300" />
              </TooltipTrigger>
              <TooltipContent>
                When using remote preset, settings will be read-only
              </TooltipContent>
            </CNTooltip>
          </TooltipProvider>
        </div>

        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{props.url}</p>
          {props.date && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {`Last updated: ${new Date(props.date).toLocaleString()}`}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="orbit-glass-button rounded-xl mb-0"
          onClick={props.handleUpdatePreset}
        >
          Update Preset
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-red-400 border-red-400/30 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300 ml-4 mb-0"
          onClick={props.handleResetPreset}
        >
          Reset to Manual
        </Button>
      </div>
    </Card>
  );
}
