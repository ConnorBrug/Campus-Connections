'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentUser, getMatchById, getChatId, sendMessage, listenToTypingStatus } from '@/lib/auth';
import type { UserProfile, Match } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Loader2, ChevronLeft, Lock, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { parseISO, isPast, addHours } from 'date-fns';
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

      // Use ALL participant IDs for chatId (supports 2, 3, or 4 riders)
      const ids = Object.keys(m.participants);
      const cId = getChatId(...ids);
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
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Msg)));
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

  const otherNames = useMemo(() => {
    if (!me || !match) return '';
    const others = Object.values(match.participants).filter((p) => p.userId !== me.id);
    if (others.length === 0) return 'Your match';
    return others.map(p => p.userName || 'Partner').join(', ');
  }, [me, match]);

  const typingName = useMemo(() => {
    if (!typingUserId || !match || !me || typingUserId === me.id) return null;
    const p = match.participants[typingUserId];
    return p?.userName?.split(' ')[0] || 'Someone';
  }, [typingUserId, match, me]);

  // Determine the chat's lifecycle state. Precedence: cancelled > completed >
  // expired > active. Each state renders a different read-only banner; only
  // 'active' shows the composer. Firestore rules also block sends after the
  // chat's expiresAt timestamp (firestore.rules#chatIsOpen) so this is
  // belt-and-suspenders.
  const chatState = useMemo<'active' | 'cancelled' | 'completed' | 'expired'>(() => {
    if (!match) return 'active';
    if (match.status === 'cancelled') return 'cancelled';
    if (match.status === 'completed') return 'completed';
    const flightTimes = Object.values(match.participants).map(p => p.flightDateTime);
    const latestFlight = flightTimes.reduce((latest, dt) => {
      const t = new Date(dt).getTime();
      return t > latest ? t : latest;
    }, 0);
    if (latestFlight > 0 && isPast(addHours(new Date(latestFlight), 4))) return 'expired';
    return 'active';
  }, [match]);

  const handleSend = async (text: string) => {
    if (!me || !chatId || chatState !== 'active') return;
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
        <div className="flex items-center justify-between border-b p-3">
          <Link href="/planned-trips" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <p className="font-medium">{otherNames}</p>
          <div className="w-10" />
        </div>

        <div ref={scrollerRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              isMine={m.senderId === me.id}
              text={m.text}
              ts={m.timestamp ? m.timestamp.toDate() : null}
            />
          ))}

          {typingName && (
            <div className="text-xs text-muted-foreground">{typingName} is typing...</div>
          )}
        </div>

        {chatState === 'cancelled' ? (
          <div className="flex items-center justify-center gap-2 border-t bg-muted/50 p-3 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4" />
            This match was cancelled. The chat is read-only.
          </div>
        ) : chatState === 'completed' ? (
          <div className="flex items-center justify-center gap-2 border-t bg-muted/50 p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            This chat is closed. The ride has been completed.
          </div>
        ) : chatState === 'expired' ? (
          <div className="flex items-center justify-center gap-2 border-t bg-muted/50 p-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            This chat has expired (flight departed over 4 hours ago).
          </div>
        ) : (
          <Composer chatId={chatId} userId={me.id} onSend={handleSend} />
        )}
      </Card>
    </div>
  );
}
