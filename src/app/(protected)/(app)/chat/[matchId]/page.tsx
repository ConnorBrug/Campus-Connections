'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentUser, getMatchById, getChatId, sendMessage, listenToTypingStatus } from '@/lib/auth';
import type { UserProfile, Match } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import MessageBubble from '@/components/chat/MessageBubble';
import Composer from '@/components/chat/Composer';

type Msg = { id: string; senderId: string; text: string; timestamp?: { toDate(): Date } | null };

export default function ChatPage() {
  const router = useRouter();
  const { matchId } = useParams<{ matchId: string }>();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Load user & match -> compute chatId
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) { router.replace('/login'); return; }
      setMe(user);

      const m = await getMatchById(matchId);
      if (!m) { router.replace('/main'); return; }
      setMatch(m);

      const ids = Object.keys(m.participants);
      const cId = getChatId(ids[0], ids[1]); // sorted inside helper
      setChatId(cId);
    })().catch(() => router.replace('/main'));
  }, [matchId, router]);

  // Subscribe to messages
  useEffect(() => {
    if (!chatId) return;
    const qRef = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(500)
    );
    const unsub = onSnapshot(qRef, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      // scroll to bottom on new messages
      requestAnimationFrame(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
      });
      setLoading(false);
    });
    return () => unsub();
  }, [chatId]);

  // Typing indicator
  useEffect(() => {
    if (!chatId) return;
    const off = listenToTypingStatus(chatId, setTypingUserId);
    return () => off();
  }, [chatId]);

  const otherName = useMemo(() => {
    if (!me || !match) return '';
    const other = Object.values(match.participants).find((p) => p.userId !== me.id);
    return other?.userName || 'Your match';
  }, [me, match]);

  const handleSend = async (text: string) => {
    if (!me || !chatId) return;
    await sendMessage(chatId, me.id, text);
  };

  if (loading || !me || !match || !chatId) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-3 text-lg text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col">
        {/* Header row */}
        <div className="flex items-center justify-between border-b p-3">
          <Link href="/planned-trips" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <p className="font-medium">{otherName}</p>
          <div className="w-10" /> {/* spacer */}
        </div>

        {/* Messages */}
        <div ref={scrollerRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              isMine={m.senderId === me.id}
              text={m.text}
              ts={m.timestamp ? m.timestamp.toDate() : null}
            />
          ))}

          {/* Typing */}
          {typingUserId && typingUserId !== 'me' && (
            <div className="text-xs text-muted-foreground">Typing…</div>
          )}
        </div>

        {/* Composer */}
        <Composer chatId={chatId} onSend={handleSend} />
      </Card>
    </div>
  );
}
