export interface ConversationDocument {
  _id: string;
  participants: string[];
  listingId: string;
  createdAt: Date;
}

export interface MessageDocument {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string; // AES-256-GCM encrypted payload
  messageType: "text" | "image" | "voice" | "system";
  mediaUrl?: string;
  readBy: { userId: string; readAt: Date }[];
  createdAt: Date;
}
