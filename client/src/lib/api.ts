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
  resolvedBy?: string | null;
  resolvedByName?: string | null;
  autoClosed?: boolean | null;
  autoClosedReason?: string | null;
  autoClosedAt?: Date | null;
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
  pdfBase64?: string | null;
  pdfName?: string | null;
  imageBase64?: string | null;
  audioBase64?: string | null;
  audioMimeType?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  videoName?: string | null;
  videoMimetype?: string | null;
  locationLatitude?: string | null;
  locationLongitude?: string | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
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
  hasMore?: boolean;
  alerts: AlertData[];
  actions: any[];
}

export const monitorAPI = {
  getConversations: async (): Promise<ConversationData[]> => {
    const response = await fetch("/api/monitor/conversations");
    if (!response.ok) {
      console.error("Failed to fetch conversations:", response.status, response.statusText);
      return [];
    }
    return response.json();
  },

  getConversationDetails: async (id: string, before?: string): Promise<ConversationDetails> => {
    const url = before 
      ? `/api/monitor/conversations/${id}?before=${before}&limit=15`
      : `/api/monitor/conversations/${id}?limit=15`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch conversation details: ${response.status}`);
    }
    return response.json();
  },

  getAlerts: async (): Promise<AlertData[]> => {
    const response = await fetch("/api/monitor/alerts");
    if (!response.ok) {
      console.error("Failed to fetch alerts:", response.status, response.statusText);
      return [];
    }
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

  sendChatMessage: async (chatId: string, clientName: string, message: string, imageBase64?: string, audioBase64?: string, audioMimeType?: string, forceAssistant?: string) => {
    const response = await apiRequest(`/api/chat/message`, "POST", { 
      chatId, 
      clientName, 
      message,
      imageBase64,
      audioBase64,
      audioMimeType,
      forceAssistant
    });
    return response;
  },
};
