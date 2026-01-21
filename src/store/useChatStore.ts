import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  lastAnalysis?: any;
}

interface ChatState {
  sessions: Record<string, Session>;
  currentSessionId: string | null;
  addSession: (title: string) => string;
  addMessage: (sessionId: string, message: Omit<Message, 'timestamp'>) => void;
  updateMessageContent: (sessionId: string, index: number, content: string) => void;
  setCurrentSession: (id: string | null) => void;
  updateSessionAnalysis: (sessionId: string, analysis: any) => void;
  deleteSession: (id: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessions: {},
      currentSessionId: null,

      addSession: (title) => {
        const id = `session_${Date.now()}`;
        set((state) => ({
          sessions: {
            ...state.sessions,
            [id]: {
              id,
              title,
              messages: [],
              timestamp: Date.now(),
            },
          },
          currentSessionId: id,
        }));
        return id;
      },

      addMessage: (sessionId, message) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;

          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                messages: [...session.messages, { ...message, timestamp: Date.now() }],
                timestamp: Date.now(),
              },
            },
          };
        });
      },

      updateMessageContent: (sessionId, index, content) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session || !session.messages[index]) return state;

          const newMessages = [...session.messages];
          newMessages[index] = { ...newMessages[index], content };

          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                messages: newMessages,
              },
            },
          };
        });
      },

      setCurrentSession: (id) => set({ currentSessionId: id }),

      updateSessionAnalysis: (sessionId, analysis) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;

          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                lastAnalysis: analysis,
              },
            },
          };
        });
      },

      deleteSession: (id) => {
        set((state) => {
          const newSessions = { ...state.sessions };
          delete newSessions[id];
          return {
            sessions: newSessions,
            currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
          };
        });
      },
    }),
    {
      name: 'maple-chat-storage',
    }
  )
);
