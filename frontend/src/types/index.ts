export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatListItem {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Chat extends ChatListItem {
  user_id: string;
  messages: Message[];
}

export interface ImportMessage {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export interface ImportChatPayload {
  title?: string;
  model?: string;
  messages?: ImportMessage[];
}

export interface ExportedChatEnvelope {
  version: number;
  exported_at: string;
  chat: ImportChatPayload;
}

export interface StreamChunk {
  content?: string;
  done?: boolean;
  error?: string;
}
