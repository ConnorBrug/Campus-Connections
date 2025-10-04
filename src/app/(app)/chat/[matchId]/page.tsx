
// This is a basic placeholder for the chat page.
// In a real app, you'd fetch match details and implement a chat UI.
'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Send, MessageSquare, Loader2, Info } from 'lucide-react';
import { getCurrentUser, getUserProfile, sendMessage, getChatId, setTypingStatus, listenToTypingStatus, getMatchById } from '@/lib/auth';
import { useParams, useRouter } from 'next/navigation';
import type { UserProfile, ChatMessage, Match } from '@/lib/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';


const MessageSkeleton = () => (
    <div className="flex items-center gap-2">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  );


export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [matchedUser, setMatchedUser] = useState<UserProfile | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Typing indicator state
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push('/login');
          return;
        }
        
        setCurrentUser(user);

        if (matchId) {
          const currentMatch = await getMatchById(matchId);
          if(!currentMatch || !currentMatch.participantIds.includes(user.id)) {
             console.error("User not part of this match.");
             router.push('/dashboard');
             return;
          }
          setMatch(currentMatch);

          const otherParticipantId = currentMatch.participantIds.find(id => id !== user.id);
          if (otherParticipantId) {
              setPartnerId(otherParticipantId);
              const matchedProfile = await getUserProfile(otherParticipantId);
              setMatchedUser(matchedProfile);
              const currentChatId = getChatId(user.id, otherParticipantId);
              setChatId(currentChatId);
          }
        }
      } catch (error) {
        console.error("Error loading chat page data:", error);
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [matchId, router]);
  
  // Real-time message listener
  useEffect(() => {
    if (!chatId) return;
    setIsHistoryLoading(true);

    const messagesColRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesColRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedMessages: ChatMessage[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            fetchedMessages.push({
                id: doc.id,
                text: data.text,
                senderId: data.senderId,
                timestamp: data.timestamp?.toDate(),
            });
        });
        setMessages(fetchedMessages);
        setIsHistoryLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Typing indicator listeners
  useEffect(() => {
    if (!chatId || !currentUser || !partnerId) return;
    const unsubscribe = listenToTypingStatus(chatId, (typingUserId) => {
        setIsOtherUserTyping(typingUserId === partnerId);
    });
    return () => unsubscribe();
  }, [chatId, currentUser, partnerId]);
  
  const updateTypingStatus = useCallback(() => {
    if (!chatId || !currentUser) return;
  
    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    }
  
    setTypingStatus(chatId, currentUser.id);
  
    typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(chatId, null);
    }, 3000); // 3-second timeout
  }, [chatId, currentUser]);

  useEffect(() => {
    if (newMessage.trim().length > 0) {
        updateTypingStatus();
    }
  }, [newMessage, updateTypingStatus]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (chatId && currentUser) setTypingStatus(chatId, null);
    };
  }, [chatId, currentUser]);


  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newMessage.trim() === '' || !currentUser || !chatId) return;

    try {
      await sendMessage(chatId, newMessage, currentUser.id);
      setNewMessage('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingStatus(chatId, null);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };


  if (isLoading || !currentUser || !matchedUser) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading chat...</p>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-headline">
            <MessageSquare className="h-6 w-6 text-primary" />
            Chat with {matchedUser?.name || 'your match'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Friendly Reminder</AlertTitle>
            <AlertDescription>
                Remember to coordinate pickup times and locations, and discuss how you'll share costs.
            </AlertDescription>
          </Alert>

          <div className="h-96 overflow-y-auto rounded-md border p-4 bg-muted/50 flex flex-col gap-4">
            {isHistoryLoading ? (
                <div className="space-y-4 p-4">
                    <MessageSkeleton />
                    <MessageSkeleton />
                    <MessageSkeleton />
                </div>
            ) : messages.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mb-2" />
                    <p className="text-center italic">No messages yet. Say hello!</p>
                 </div>
            ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-end gap-2',
                      msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-xs md:max-w-md rounded-lg px-4 py-2',
                        msg.senderId === currentUser.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-card-foreground shadow-sm'
                      )}
                    >
                      <p className="text-sm">{msg.text}</p>
                       <p className="text-xs opacity-70 mt-1 text-right">
                        {msg.timestamp ? format(msg.timestamp, 'p') : ''}
                      </p>
                    </div>
                  </div>
                ))
            )}
             {isOtherUserTyping && (
                <div className="flex items-end gap-2 justify-start">
                    <div className="max-w-xs md:max-w-md rounded-lg px-4 py-2 bg-card text-card-foreground shadow-sm">
                        <div className="flex items-center gap-1">
                            <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                            <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                            <span className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse"></span>
                        </div>
                    </div>
                </div>
            )}
             <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Textarea
              name="message"
              placeholder="Type your message..."
              className="min-h-[40px] flex-1 resize-none"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                  }
              }}
              required
            />
            <Button type="submit" className="self-end">
              <Send className="mr-2 h-4 w-4" /> Send
            </Button>
          </form>
        </CardContent>
        <CardFooter>
           <p className="text-xs text-muted-foreground">Remember to be respectful and clear in your communication.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
