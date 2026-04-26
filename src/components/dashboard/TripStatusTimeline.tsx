'use client';

import { CheckCircle, Search, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TripRequest } from '@/lib/types';

interface TripStatusTimelineProps {
  status: TripRequest['status'];
}

export function TripStatusTimeline({ status }: TripStatusTimelineProps) {
  const isPending = status === 'pending';
  const isMatched = status === 'matched';
  const isCompleted = status === 'completed';

  const steps = [
    {
      icon: CheckCircle,
      label: 'Submitted',
      done: true,
      active: false,
    },
    {
      icon: Search,
      label: 'Matching',
      done: isMatched || isCompleted,
      active: isPending,
    },
    {
      icon: MessageSquare,
      label: 'Matched',
      done: isMatched || isCompleted,
      active: false,
    },
  ];

  return (
    <div className="flex items-center justify-between gap-0">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors',
                  step.done && 'bg-primary border-primary text-primary-foreground',
                  step.active && 'bg-primary/20 border-primary text-primary animate-pulse',
                  !step.done && !step.active && 'bg-muted border-border text-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium leading-tight text-center',
                  step.done || step.active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line (not after the last step) */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 mt-[-1.25rem]',
                  steps[i + 1].done || steps[i + 1].active ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
