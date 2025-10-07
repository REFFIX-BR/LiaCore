import { apiRequest } from "./queryClient";

export interface ConversationData {
  id: string;
  chatId: string;
  clientName: string;
  assistantType: string;
  status: string;
  sentiment: string | null;
  urgency: string | null;
  duration: number;
  lastMessage: string | null;
  lastMessageTime: Date;
}

export interface MessageData {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  timestamp: Date;
  functionCall?: any;
  assistant: string | null;
}

export interface AlertData {
  id: string;
  conversationId: string;
  type: string;
  severity: string;
  message: string;
  resolved: boolean;
}

export interface ConversationDetails {
  conversation: ConversationData;
  messages: MessageData[];
  alerts: AlertData[];
  actions: any[];
}

export const monitorAPI = {
  getConversations: async (): Promise<ConversationData[]> => {
    const response = await fetch("/api/monitor/conversations");
    return response.json();
  },

  getConversationDetails: async (id: string): Promise<ConversationDetails> => {
    const response = await fetch(`/api/monitor/conversations/${id}`);
    return response.json();
  },

  getAlerts: async (): Promise<AlertData[]> => {
    const response = await fetch("/api/monitor/alerts");
    return response.json();
  },

  transferToHuman: async (conversationId: string, department: string, notes: string) => {
    return apiRequest("POST", `/api/supervisor/transfer`, { conversationId, department, notes, supervisorId: "supervisor" });
  },

  pauseAI: async (conversationId: string) => {
    return apiRequest("POST", `/api/supervisor/pause`, { conversationId, supervisorId: "supervisor" });
  },

  addNote: async (conversationId: string, note: string) => {
    return apiRequest("POST", `/api/supervisor/note`, { conversationId, note, supervisorId: "supervisor" });
  },

  markResolved: async (conversationId: string) => {
    return apiRequest("POST", `/api/supervisor/resolve`, { conversationId, supervisorId: "supervisor" });
  },

  sendChatMessage: async (chatId: string, clientName: string, message: string) => {
    const response = await apiRequest("POST", `/api/chat/message`, { chatId, clientName, message });
    return response.json();
  },
};
