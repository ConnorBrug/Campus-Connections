'use client';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function MessageBubble({
  isMine,
  text,
  ts,
}: {
  isMine: boolean;
  text: string;
  ts?: Date | null;
}) {
  return (
    <div className={cn('flex w-full', isMine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2 shadow-sm',
          isMine ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
        {ts && (
          <span
            className={cn(
              'mt-1 block text-[10px] opacity-70',
              isMine ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            {format(ts, 'p')}
          </span>
        )}
      </div>
    </div>
  );
}
