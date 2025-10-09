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
  transferredToHuman?: boolean | null;
  assignedTo?: string | null;
  metadata?: {
    transferred?: boolean;
    transferredTo?: string;
    transferredAt?: string;
    transferNotes?: string;
  };
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
    return apiRequest(`/api/supervisor/transfer`, "POST", { conversationId, department, notes, supervisorId: "supervisor" });
  },

  pauseAI: async (conversationId: string) => {
    return apiRequest(`/api/supervisor/pause`, "POST", { conversationId, supervisorId: "supervisor" });
  },

  addNote: async (conversationId: string, note: string) => {
    return apiRequest(`/api/supervisor/note`, "POST", { conversationId, note, supervisorId: "supervisor" });
  },

  markResolved: async (conversationId: string) => {
    return apiRequest(`/api/supervisor/resolve`, "POST", { conversationId, supervisorId: "supervisor" });
  },

  sendChatMessage: async (chatId: string, clientName: string, message: string) => {
    const response = await apiRequest(`/api/chat/message`, "POST", { chatId, clientName, message });
    return response.json();
  },
};
