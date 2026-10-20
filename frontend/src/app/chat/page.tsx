"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import {
  createChat,
  deleteChat,
  fetchChat,
  fetchChats,
  fetchModels,
  importChat,
  sendMessage,
} from "@/lib/api";
import type {
  Chat,
  ChatListItem,
  ExportedChatEnvelope,
  ImportChatPayload,
  Message,
} from "@/types";

export default function ChatPage() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("llama3.2");
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline">("checking");

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) throw new Error("Not authenticated");
    return t;
  }, [getToken]);

  /**
   * Pick a model that is actually installed locally.
   *
   * Imported chats may reference a model from another machine (the one stored in
   * the exported JSON). Sending that name to Ollama fails when it is not pulled
   * here, so fall back to the currently selected model (or the first available
   * one) instead.
   */
  const resolveAvailableModel = useCallback(
    (candidate?: string | null): string => {
      const name = candidate?.trim();
      if (name && availableModels.includes(name)) return name;
      if (availableModels.includes(selectedModel)) return selectedModel;
      return availableModels[0] ?? name ?? selectedModel;
    },
    [availableModels, selectedModel]
  );

  // Keep the selector in sync with the models Ollama actually reports. Without
  // this, a chat referencing an uninstalled model would leave `selectedModel`
  // pointing at it while the <select> visually shows a different (valid) model.
  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
      setSelectedModel(availableModels[0]);
    }
  }, [availableModels, selectedModel]);

  // ── Load chats + models on mount ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const t = await token();
        const [chatList, models] = await Promise.all([
          fetchChats(t),
          fetchModels(t),
        ]);
        setChats(chatList);
        if (models.length > 0) {
          setAvailableModels(models);
          setSelectedModel(models[0]);
          setOllamaStatus("online");
        } else {
          setOllamaStatus("offline");
        }
      } catch {
        setOllamaStatus("offline");
      }
    })();
  }, [token]);

  // ── Select a chat ──────────────────────────────────────────────────────────
  const handleSelectChat = useCallback(
    async (id: string) => {
      if (id === activeChatId) return;
      setActiveChatId(id);
      setMessages([]);
      setStreamError(null);
      setLoadingChat(true);
      try {
        const t = await token();
        const chat: Chat = await fetchChat(t, id);
        setMessages(chat.messages);
        // Adopt the chat's model when it is installed; otherwise keep using a
        // valid local model so the conversation can continue.
        setSelectedModel(resolveAvailableModel(chat.model));
      } catch (err) {
        console.error("Failed to fetch chat:", err);
      } finally {
        setLoadingChat(false);
      }
    },
    [activeChatId, token, resolveAvailableModel]
  );

  // ── New chat ───────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    try {
      const t = await token();
      const chat = await createChat(t, "New Chat", selectedModel);
      setChats((prev) => [chat, ...prev]);
      setActiveChatId(chat.id);
      setMessages([]);
      setStreamError(null);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  }, [token, selectedModel]);

  // ── Delete chat ────────────────────────────────────────────────────────────
  const handleDeleteChat = useCallback(
    async (id: string) => {
      try {
        const t = await token();
        await deleteChat(t, id);
        setChats((prev) => prev.filter((c) => c.id !== id));
        if (activeChatId === id) {
          setActiveChatId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error("Failed to delete chat:", err);
      }
    },
    [activeChatId, token]
  );

  const handleExportChat = useCallback(
    async (id: string) => {
      try {
        const t = await token();
        const chat = await fetchChat(t, id);
        const payload: ExportedChatEnvelope = {
          version: 1,
          exported_at: new Date().toISOString(),
          chat: {
            title: chat.title,
            model: chat.model,
            messages: chat.messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
              created_at: msg.created_at,
            })),
          },
        };

        const safeTitle = chat.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const filename = safeTitle
          ? `chat-${safeTitle}.json`
          : `chat-${Date.now()}.json`;

        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Failed to export chat:", err);
      }
    },
    [token]
  );

  const handleImportChat = useCallback(
    async (file: File) => {
      try {
        const raw = JSON.parse(await file.text()) as
          | ExportedChatEnvelope
          | ImportChatPayload;

        const base = (
          "chat" in raw && raw.chat && typeof raw.chat === "object"
            ? raw.chat
            : raw
        ) as ImportChatPayload;

        const title =
          typeof base.title === "string" && base.title.trim().length > 0
            ? base.title
            : "Imported Chat";
        // The exported model may not be installed on this machine. Resolve it
        // against the local model list so the imported chat keeps working with
        // whichever model is available here.
        const model = resolveAvailableModel(
          typeof base.model === "string" ? base.model : selectedModel
        );
        const messages = Array.isArray(base.messages)
          ? base.messages
              .map((msg) => ({
                role: msg.role,
                content: msg.content,
                created_at: msg.created_at,
              }))
              .filter(
                (msg) =>
                  (msg.role === "user" || msg.role === "assistant") &&
                  typeof msg.content === "string" &&
                  msg.content.trim().length > 0
              )
          : [];

        const payload: ImportChatPayload = {
          title,
          model,
          messages,
        };

        const t = await token();
        const imported = await importChat(t, payload);
        setChats((prev) => [imported, ...prev]);
        setActiveChatId(imported.id);
        setMessages(imported.messages);
        setStreamError(null);
        setSelectedModel(resolveAvailableModel(imported.model));
      } catch (err) {
        console.error("Failed to import chat:", err);
      }
    },
    [selectedModel, resolveAvailableModel, token]
  );

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (content: string) => {
      if (!activeChatId || isStreaming) return;

      // Never send a model name that Ollama does not have installed.
      const model = resolveAvailableModel(selectedModel);
      if (model !== selectedModel) setSelectedModel(model);

      // Optimistically add user message
      const optimisticUser: Message = {
        id: `__opt_user_${Date.now()}`,
        chat_id: activeChatId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);
      setIsStreaming(true);
      setStreamingContent("");
      setStreamError(null);

      try {
        const t = await token();
        let full = "";

        await sendMessage(
          t,
          activeChatId,
          content,
          model,
          (chunk) => {
            full += chunk;
            setStreamingContent(full);
          },
          () => {
            // Replace streaming placeholder with real message
            const finalMsg: Message = {
              id: `__final_${Date.now()}`,
              chat_id: activeChatId,
              role: "assistant",
              content: full,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, finalMsg]);
            setStreamingContent("");
            setIsStreaming(false);

            // Update chat title in list (it may have changed after first message)
            fetchChats(t)
              .then(setChats)
              .catch(() => {});
          },
          (err) => {
            console.error("Stream error:", err);
            setStreamError(err);
            setIsStreaming(false);
            setStreamingContent("");
          }
        );
      } catch (err) {
        console.error("Send failed:", err);
        setStreamError(
          err instanceof Error ? err.message : "Failed to send message"
        );
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [activeChatId, isStreaming, resolveAvailableModel, selectedModel, token]
  );

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/sign-in");
  }, [signOut, router]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        ollamaStatus={ollamaStatus}
        selectedModel={selectedModel}
        availableModels={availableModels}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onExportChat={handleExportChat}
        onModelChange={setSelectedModel}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center px-6 py-3 border-b border-surface-border bg-white">
          <h1 className="text-sm font-medium text-ink">
            {activeChatId
              ? chats.find((c) => c.id === activeChatId)?.title ?? "Chat"
              : "New Chat"}
          </h1>
        </header>

        <ChatWindow
          chatId={activeChatId}
          messages={messages}
          isLoading={loadingChat}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          errorMessage={streamError}
          ollamaStatus={ollamaStatus}
          onSend={handleSend}
          onImportChat={handleImportChat}
        />
      </main>
    </div>
  );
}
