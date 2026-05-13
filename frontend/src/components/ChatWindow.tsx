"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import MessageBubble from "./MessageBubble";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface ChatWindowProps {
  chatId: string | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  ollamaStatus: "checking" | "online" | "offline";
  onSend: (content: string) => void;
}

export default function ChatWindow({
  chatId,
  messages,
  isLoading,
  isStreaming,
  streamingContent,
  ollamaStatus,
  onSend,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isStreaming || isLoading || !chatId) return;
    setInput("");
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend =
    input.trim().length > 0 &&
    !isStreaming &&
    !isLoading &&
    ollamaStatus !== "offline" &&
    !!chatId;

  const showCenteredComposer = !!chatId && messages.length === 0 && !isStreaming && !isLoading;

  const renderComposer = () => (
    <>
      {ollamaStatus === "offline" && (
        <p className="text-[11px] text-amber-600 mb-2 flex items-center gap-1.5">
          <span>⚠️</span>
          Ollama unreachable. Start with:{" "}
          <code className="font-mono bg-surface-muted rounded px-1 py-0.5">
            OLLAMA_ORIGINS=&quot;*&quot; ollama serve
          </code>
        </p>
      )}

      <div
        className={cn(
          "flex items-end gap-2.5 rounded-2xl border-2 bg-surface px-3.5 py-2.5 transition-all",
          "border-ink/20 shadow-[0_0_0_1px_rgba(17,17,17,0.06)]",
          "focus-within:border-ink/45 focus-within:shadow-[0_0_0_3px_rgba(17,17,17,0.12)]"
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            ollamaStatus === "offline"
              ? "Select a model to start chatting"
              : "Message..."
          }
          disabled={isStreaming || isLoading || !chatId}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-ghost focus:outline-none min-h-[22px] max-h-[160px] leading-[22px] disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all",
            canSend
              ? "bg-ink text-white hover:bg-accent-hover"
              : "bg-surface-muted text-ink-ghost cursor-not-allowed"
          )}
        >
          <ArrowUp size={14} strokeWidth={2.5} />
        </button>
      </div>
    </>
  );

  // Empty state
  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-ink-ghost select-none px-6">
        <span className="text-5xl opacity-50">🦙</span>
        <p className="text-sm text-center">
          Create a chat to start. Using{" "}
          <span className="font-semibold text-ink-secondary">no model selected</span>
        </p>
      </div>
    );
  }

  // Build displayed messages (append streaming placeholder)
  const displayMessages = [...messages];
  const streamingMessage: Message | null =
    isStreaming
      ? {
          id: "__streaming__",
          chat_id: chatId,
          role: "assistant",
          content: streamingContent,
          created_at: new Date().toISOString(),
        }
      : null;

  if (showCenteredComposer) {
    return (
      <div className="flex-1 flex flex-col justify-center px-6">
        <div className="w-full max-w-3xl mx-auto">
          <p className="text-center text-2xl text-black font-bold mb-4">Start a conversation</p>
          {renderComposer()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-ink-ghost animate-pulse-dot"
                  style={{ animationDelay: `${i * 0.16}s` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {displayMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {streamingMessage && (
              <MessageBubble
                key="__streaming__"
                message={streamingMessage}
                isStreaming
              />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-surface-border px-4 py-3 bg-white">{renderComposer()}</div>
    </div>
  );
}
