import type { Chat, ChatListItem, ImportChatPayload, StreamChunk } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Chats ────────────────────────────────────────────────────────────────────

export async function fetchChats(token: string): Promise<ChatListItem[]> {
  const res = await fetch(`${BASE}/chats/`, { headers: authHeaders(token) });
  return handleResponse<ChatListItem[]>(res);
}

export async function createChat(
  token: string,
  title = "New Chat",
  model = "llama3.2"
): Promise<Chat> {
  const res = await fetch(`${BASE}/chats/`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ title, model }),
  });
  return handleResponse<Chat>(res);
}

export async function fetchChat(token: string, chatId: string): Promise<Chat> {
  const res = await fetch(`${BASE}/chats/${chatId}`, {
    headers: authHeaders(token),
  });
  return handleResponse<Chat>(res);
}

export async function deleteChat(token: string, chatId: string): Promise<void> {
  const res = await fetch(`${BASE}/chats/${chatId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete chat: ${res.status}`);
  }
}

export async function importChat(
  token: string,
  payload: ImportChatPayload
): Promise<Chat> {
  const res = await fetch(`${BASE}/chats/import`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<Chat>(res);
}

// ── Models ───────────────────────────────────────────────────────────────────

export async function fetchModels(token: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models/`, { headers: authHeaders(token) });
  const data = await handleResponse<{ models: string[] }>(res);
  return data.models;
}

// ── Streaming message ────────────────────────────────────────────────────────

export async function sendMessage(
  token: string,
  chatId: string,
  content: string,
  model: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  const res = await fetch(`${BASE}/chats/${chatId}/messages`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ content, model }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        const chunk: StreamChunk = JSON.parse(line.slice(6));
        if (chunk.content) onChunk(chunk.content);
        if (chunk.done) onDone();
        if (chunk.error) onError(chunk.error);
      } catch {
        // ignore malformed lines
      }
    }
  }
}
