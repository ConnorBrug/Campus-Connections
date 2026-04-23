'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getCurrentUser, getMatchById, getChatId, sendMessage, listenToTypingStatus } from '@/lib/auth';
import type { UserProfile, Match } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, Lock, XCircle, Clock, SearchX, AlertTriangle, Home } from 'lucide-react';
import Link from 'next/link';
import { isPast, addHours } from 'date-fns';
import MessageBubble from '@/components/chat/MessageBubble';
import Composer from '@/components/chat/Composer';

type Msg = { id: string; senderId: string; text: string; timestamp?: { toDate(): Date } | null };

type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }       // (a) match doc doesn't exist
  | { kind: 'error'; msg: string }
  | { kind: 'ready'; match: Match; chatId: string };

/**
 * Friendly dead-end page used for (a) missing match, (b) cancelled, (c)
 * expired, or any other terminal state where we don't want to render the
 * live chat. Always offers a "Back to dashboard" link.
 */
function ChatUnavailable({
  icon: Icon,
  title,
  message,
}: {
  icon: typeof SearchX;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="mx-auto w-full max-w-md p-6 text-center">
        <div className="flex flex-col items-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold mb-2 font-headline">{title}</h1>
          <p className="text-muted-foreground mb-6">{message}</p>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button asChild>
              <Link href="/main" className="inline-flex items-center gap-2">
                <Home className="h-4 w-4" aria-hidden="true" />
                Back to dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/planned-trips">See my trips</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const { matchId } = useParams<{ matchId: string }>();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Load user & match -> compute chatId
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCurrentUser();
        if (cancelled) return;
        if (!user) { router.replace('/login'); return; }
        setMe(user);

        const m = await getMatchById(matchId);
        if (cancelled) return;
        if (!m) {
          setState({ kind: 'missing' });
          return;
        }

        // Use ALL participant IDs for chatId (supports 2, 3, or 4 riders)
        const ids = Object.keys(m.participants);
        const cId = getChatId(...ids);
        setState({ kind: 'ready', match: m, chatId: cId });
      } catch (e) {
        if (cancelled) return;
        setState({
          kind: 'error',
          msg: e instanceof Error ? e.message : 'We could not load this chat.',
        });
      }
    })();
    return () => { cancelled = true; };
  }, [matchId, router]);

  // Subscribe to messages. Gate on auth.authStateReady() so the snapshot
  // listener never opens before the Firebase SDK has an authenticated user
  // attached - otherwise Firestore rules (which require chat participation)
  // reject the read with permission-denied and the listener is torn down
  // even after auth hydrates.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const chatId = state.chatId;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      if (cancelled) return;
      const qRef = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'asc'),
        limit(500)
      );
      unsub = onSnapshot(
        qRef,
        (snap) => {
          setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Msg)));
          requestAnimationFrame(() => {
            scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
          });
          setMessagesLoaded(true);
        },
        () => {
          // Permission-denied or similar - surface as "can't load chat"
          // rather than leaving the spinner running forever.
          setMessagesLoaded(true);
        }
      );
    })();
    return () => { cancelled = true; unsub?.(); };
  }, [state]);

  // Typing indicator - same auth gate as the messages listener.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const chatId = state.chatId;
    let off: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      if (cancelled) return;
      off = listenToTypingStatus(chatId, setTypingUserId);
    })();
    return () => { cancelled = true; off?.(); };
  }, [state]);

  const otherNames = useMemo(() => {
    if (!me || state.kind !== 'ready') return '';
    const others = Object.values(state.match.participants).filter((p) => p.userId !== me.id);
    if (others.length === 0) return 'Your match';
    return others.map(p => p.userName || 'Partner').join(', ');
  }, [me, state]);

  const typingName = useMemo(() => {
    if (!typingUserId || state.kind !== 'ready' || !me || typingUserId === me.id) return null;
    const p = state.match.participants[typingUserId];
    return p?.userName?.split(' ')[0] || 'Someone';
  }, [typingUserId, state, me]);

  // Determine the chat's lifecycle state. Precedence: cancelled > completed >
  // expired > active. Each state renders a different read-only banner; only
  // 'active' shows the composer. Firestore rules also block sends after the
  // chat's expiresAt timestamp (firestore.rules#chatIsOpen) so this is
  // belt-and-suspenders.
  const chatState = useMemo<'active' | 'cancelled' | 'completed' | 'expired'>(() => {
    if (state.kind !== 'ready') return 'active';
    const match = state.match;
    if (match.status === 'cancelled') return 'cancelled';
    if (match.status === 'completed') return 'completed';
    const flightTimes = Object.values(match.participants).map(p => p.flightDateTime);
    const latestFlight = flightTimes.reduce((latest, dt) => {
      const t = new Date(dt).getTime();
      return t > latest ? t : latest;
    }, 0);
    if (latestFlight > 0 && isPast(addHours(new Date(latestFlight), 4))) return 'expired';
    return 'active';
  }, [state]);

  const handleSend = async (text: string) => {
    if (!me || state.kind !== 'ready' || chatState !== 'active') return;
    await sendMessage(state.chatId, me.id, text);
  };

  // --- render terminal states as friendly pages ---------------------
  if (state.kind === 'missing') {
    return (
      <ChatUnavailable
        icon={SearchX}
        title="Chat not found"
        message="This match doesn't exist anymore, or you may not have access to it. It might have been cleaned up after both rides completed."
      />
    );
  }

  if (state.kind === 'error') {
    return (
      <ChatUnavailable
        icon={AlertTriangle}
        title="We couldn't open this chat"
        message={state.msg}
      />
    );
  }

  if (state.kind === 'loading' || !me || !messagesLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-3 text-lg text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  // Cancelled and expired still render the message thread (read-only) so the
  // user can reference what was said, but with a banner + no composer.
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col">
        <div className="flex items-center justify-between border-b p-3">
          <Link
            href="/planned-trips"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
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
            <XCircle className="h-4 w-4" aria-hidden="true" />
            This match was cancelled. The chat is read-only.
          </div>
        ) : chatState === 'completed' ? (
          <div className="flex items-center justify-center gap-2 border-t bg-muted/50 p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" aria-hidden="true" />
            This chat is closed. The ride has been completed.
          </div>
        ) : chatState === 'expired' ? (
          <div className="flex items-center justify-center gap-2 border-t bg-muted/50 p-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" />
            This chat has expired (flight departed over 4 hours ago).
          </div>
        ) : (
          <Composer chatId={state.chatId} userId={me.id} onSend={handleSend} />
        )}
      </Card>
    </div>
  );
}
