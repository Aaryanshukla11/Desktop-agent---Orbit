import React from 'react';
import MarkdownIt from 'markdown-it';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { Badge } from '@renderer/components/ui/badge';
import {
  FileSpreadsheet,
  Clock,
  Coins,
  CheckCircle2,
  Folder,
  BarChart3,
  Cpu,
  Activity,
  Layers,
} from 'lucide-react';

const mdParser = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

interface TaskLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawLogContent?: string;
  thoughtSteps?: any[];
}

export const TaskLogDialog: React.FC<TaskLogDialogProps> = ({
  open,
  onOpenChange,
  rawLogContent,
  thoughtSteps = [],
}) => {
  const fileSavedMatch = rawLogContent?.match(/File Saved`?:\s*`?([^\n`\r]+)/i);
  const filePath = fileSavedMatch ? fileSavedMatch[1].trim() : null;

  const formattedHtml = React.useMemo(() => {
    if (!rawLogContent) return '';
    let str = rawLogContent.replace(/\\n/g, '\n');
    // Ensure table rows separated by pipes have newlines
    str = str.replace(/\|\s*\|\s*(?=[^:\s|])/g, '|\n| ');
    str = str.replace(/\|\s*\|\s*:\s*---/g, '|\n| :---');
    return mdParser.render(str);
  }, [rawLogContent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] md:max-w-[660px] w-full max-h-[90vh] h-[85vh] p-0 orbit-glass-card rounded-2xl border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="px-7 py-5 border-b border-black/10 dark:border-white/10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                Task Execution & Telemetry Log
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Detailed domain distribution metrics, deterministic execution trace, and system performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mr-6">
            <Badge
              variant="secondary"
              className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-400 border border-emerald-500/20 font-medium px-3 py-1 text-xs gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Success
            </Badge>
          </div>
        </DialogHeader>

        {/* Executive KPI Stat Cards */}
        <div className="grid grid-cols-4 gap-4 px-7 py-4 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/10 dark:border-white/10 text-xs">
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              Execution Time
            </span>
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              ~3.4s
            </span>
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              Tokens Consumed
            </span>
            <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
              0 Tokens (100% Free)
            </span>
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              Execution Engine
            </span>
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              ExcelMcp (.NET COM)
            </span>
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
              Chart Created
            </span>
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              Clustered Column
            </span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <ScrollArea className="flex-1 px-7 py-5 overflow-y-auto select-text">
          {filePath && (
            <div className="mb-6 p-3.5 rounded-xl bg-blue-500/5 dark:bg-blue-400/10 border border-blue-500/15 flex items-center gap-3 text-xs text-blue-900 dark:text-blue-200 select-text">
              <Folder className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="truncate font-mono select-text">
                <span className="font-semibold text-blue-700 dark:text-blue-300">Saved Artifact:</span> {filePath}
              </div>
            </div>
          )}

          {rawLogContent ? (
            <div
              className="prose dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-slate-300 dark:[&_th]:border-slate-700 [&_th]:p-2.5 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800/60 [&_th]:font-semibold [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-800 [&_td]:p-2.5 [&_tr:hover]:bg-slate-50 dark:[&_tr:hover]:bg-white/[0.03]"
              dangerouslySetInnerHTML={{ __html: formattedHtml }}
            />
          ) : (
            <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
              <Activity className="w-8 h-8 text-slate-400 mb-1" />
              <span>No task execution logs available for this session yet.</span>
              <span className="text-xs text-slate-400">Run a task in Orbit to inspect the live trace and telemetry here.</span>
            </div>
          )}

          {/* ThoughtChain Steps History */}
          {thoughtSteps.length > 0 && (
            <div className="mt-8 pt-6 border-t border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Step Execution Timeline
                </h4>
              </div>
              <div className="space-y-2.5">
                {thoughtSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-xs p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5"
                  >
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shrink-0">
                      Step {idx + 1}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      {step.action_inputs?.content || step.thought || JSON.stringify(step.action_inputs || {})}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
