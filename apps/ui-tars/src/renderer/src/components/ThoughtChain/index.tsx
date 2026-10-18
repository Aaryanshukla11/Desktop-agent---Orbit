/**
 
 */
import { MousePointerClick } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';

import { PredictionParsed } from '@UI-TARs/shared/types';
import { ActionIconMap } from '@renderer/const/actions';
import { Markdown } from '../markdown';

interface ThoughtStepCardProps {
  step: PredictionParsed;
  index: number;
  onClick?: () => void;
  hasSomImage: boolean;
}

function ThoughtStepCard({ step, onClick, hasSomImage }: ThoughtStepCardProps) {
  const ActionIcon = ActionIconMap[step?.action_type] || MousePointerClick;

  return (
    <>
      {step.action_type && (
        <Button
          variant="outline"
          className="orbit-glass-button rounded-full mb-4 text-xs font-normal text-slate-800 dark:text-slate-200 border-slate-300 dark:border-white/15 shadow-sm"
          size="sm"
          onClick={onClick}
          disabled={!hasSomImage}
        >
          <ActionIcon className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
          {step.action_type === 'call_user' ? (
            'Waiting for user to take control'
          ) : (
            <>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">Action:</span>
              <span className="text-slate-700 dark:text-slate-300 max-w-50 truncate font-mono">
                {step.action_type}
                {step.action_inputs?.start_box &&
                  ` (start_box: ${step.action_inputs.start_box})`}
                {step.action_inputs?.content &&
                  ` (${step.action_inputs.content})`}
                {step.action_inputs?.key && ` (${step.action_inputs.key})`}
              </span>
            </>
          )}
        </Button>
      )}
    </>
  );
}

interface ThoughtChainProps {
  steps: PredictionParsed[];
  hasSomImage: boolean;
  somImageHighlighted?: boolean;
  onClick?: () => void;
}

export default function ThoughtChain({
  steps,
  onClick,
  hasSomImage,
}: ThoughtChainProps) {
  const reflectionStep = steps?.find((step) => step.reflection);
  const thoughtStep = steps?.find((step) => step.thought);

  return (
    <div className="space-y-2">
      {reflectionStep && (
        <div className="my-2 p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs leading-relaxed">
          <Markdown>{reflectionStep.reflection || ''}</Markdown>
        </div>
      )}

      {thoughtStep?.thought && (
        <div className="my-2 p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs leading-relaxed">
          <Markdown>{thoughtStep.thought || ''}</Markdown>
        </div>
      )}

      {steps?.map?.((step, index) => (
        <ThoughtStepCard
          key={index}
          step={step}
          index={index}
          onClick={onClick}
          hasSomImage={hasSomImage}
        />
      ))}
    </div>
  );
}
