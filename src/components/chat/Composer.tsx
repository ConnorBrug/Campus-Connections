'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendHorizonal } from 'lucide-react';
import { setTypingStatus } from '@/lib/auth';

// Keep in sync with firestore.rules (messages.create text.size() check).
const MAX_MESSAGE_LEN = 2000;

export default function Composer({
  chatId,
  userId,
  onSend,
}: {
  chatId: string;
  userId: string;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTyping = useCallback(async () => {
    try { await setTypingStatus(chatId, userId); } catch {}
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(async () => {
      try { await setTypingStatus(chatId, null); } catch {}
    }, 1500);
  }, [chatId, userId]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      setTypingStatus(chatId, null).catch(() => {});
    };
  }, [chatId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (t.length > MAX_MESSAGE_LEN) return;
    setText('');
    await onSend(t);
    try { await setTypingStatus(chatId, null); } catch {}
  };

  return (
    <div className="flex items-center gap-2 border-t bg-background p-3">
      <Input
        placeholder="Write a message…"
        value={text}
        maxLength={MAX_MESSAGE_LEN}
        onChange={(e) => { setText(e.target.value); startTyping(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <Button onClick={send} disabled={!text.trim() || text.length > MAX_MESSAGE_LEN} aria-label="Send">
        <SendHorizonal className="h-4 w-4" />
      </Button>
    </div>
  );
}
