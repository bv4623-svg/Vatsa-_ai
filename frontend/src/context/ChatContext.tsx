// frontend/src/context/ChatContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useChat, UseChatReturn } from '@/hooks/useChat';

// Create context (null as default, will be overridden by Provider)
export const ChatContext = createContext<UseChatReturn | null>(null);

// Provider component – wrap your app with this
export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChat();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

// Custom hook to use the context safely
export function useChatContext(): UseChatReturn {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}