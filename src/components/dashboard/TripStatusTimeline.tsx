
'use client';

import { CheckCircle, Search, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TripRequest } from '@/lib/types';

interface TripStatusTimelineProps {
  status: TripRequest['status'];
}

const TimelineStep = ({ icon: Icon, title, description, isCompleted, isActive }: { icon: React.ElementType, title: string, description: string, isCompleted: boolean, isActive: boolean }) => {
  return (
    <div className="flex items-start gap-4">
      <div className={cn(
        "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2",
        isCompleted ? "bg-primary border-primary text-primary-foreground" : "",
        isActive ? "bg-primary/20 border-primary text-primary animate-pulse" : "",
        !isCompleted && !isActive ? "bg-muted border-border text-muted-foreground" : ""
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h4 className={cn("font-semibold", isCompleted || isActive ? "text-foreground" : "text-muted-foreground")}>{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};

export function TripStatusTimeline({ status }: TripStatusTimelineProps) {
  const isPending = status === 'pending';
  const isMatched = status === 'matched';
  const isCompleted = status === 'completed';

  const steps = [
    {
      icon: CheckCircle,
      title: 'Trip Submitted',
      description: 'We have your trip details.',
      isCompleted: true, // Always completed if there's an active trip
      isActive: false,
    },
    {
      icon: Search,
      title: 'Matching In Progress',
      description: 'We are looking for a match for you.',
      isCompleted: isMatched || isCompleted,
      isActive: isPending,
    },
    {
      icon: MessageSquare,
      title: 'Chat With Match',
      description: 'Coordinate your ride details.',
      isCompleted: isMatched || isCompleted,
      isActive: false, // This step is either done or not, not "active"
    },
  ];

  return (
    <div className="space-y-6">
      <div className="relative space-y-8 pl-4">
          {/* Vertical line */}
          <div className="absolute left-[24px] top-4 h-[calc(100%-2rem)] w-0.5 bg-border -translate-x-1/2"></div>
          {steps.map((step, index) => (
            <TimelineStep key={index} {...step} />
          ))}
      </div>
    </div>
  );
}
