"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatListItem } from "@/types";

interface SidebarProps {
  chats: ChatListItem[];
  activeChatId: string | null;
  ollamaStatus: "checking" | "online" | "offline";
  selectedModel: string;
  availableModels: string[];
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onExportChat: (id: string) => void;
  onModelChange: (model: string) => void;
  onSignOut: () => void;
}

export default function Sidebar({
  chats,
  activeChatId,
  ollamaStatus,
  selectedModel,
  availableModels,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onExportChat,
  onModelChange,
  onSignOut,
}: SidebarProps) {
  const { user } = useUser();

  return (
    <aside className="flex flex-col w-64 h-full bg-surface-subtle border-r border-surface-border flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-surface-border">
        <span className="text-lg">🦙</span>
        <span className="font-semibold text-sm tracking-tight text-ink">
          Ollama Chat
        </span>
        {user && (
          <span className="ml-auto text-[11px] text-ink-ghost truncate max-w-[80px]">
            @{user.username ?? user.firstName ?? "user"}
          </span>
        )}
      </div>

      {/* Model selector */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-medium uppercase tracking-widest text-ink-ghost mb-1.5 px-1">
          Model
        </p>
        {ollamaStatus === "offline" ? (
          <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
            Ollama not found at :11434
            <button
              onClick={() => window.location.reload()}
              className="block mt-0.5 underline text-red-500 hover:text-red-700"
            >
              Retry
            </button>
          </div>
        ) : availableModels.length === 0 ? (
          <div className="rounded-md border border-surface-border bg-surface px-3 py-2 text-xs text-ink-muted">
            {ollamaStatus === "checking" ? "Loading models…" : "No models found"}
          </div>
        ) : (
          <select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full text-xs border border-surface-border rounded-md px-2.5 py-1.5 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-ink cursor-pointer"
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* New chat button */}
      <div className="px-3 pb-2">
        <button
          onClick={onNewChat}
          className="flex items-center justify-center gap-2 w-full rounded-md bg-ink text-surface text-xs font-medium py-2 hover:bg-accent-hover transition-colors"
        >
          <Plus size={13} strokeWidth={2.5} />
          New Chat
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {chats.length === 0 ? (
          <p className="text-center text-xs text-ink-ghost py-6">No chats yet</p>
        ) : (
          chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onSelect={() => onSelectChat(chat.id)}
              onDelete={() => onDeleteChat(chat.id)}
              onExport={() => onExportChat(chat.id)}
            />
          ))
        )}
      </div>

      {/* Sign out */}
      <div className="border-t border-surface-border p-3">
        <button
          onClick={onSignOut}
          className="w-full text-xs text-ink-muted hover:text-ink transition-colors py-1.5 rounded-md hover:bg-surface-muted"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function ChatRow({
  chat,
  isActive,
  onSelect,
  onDelete,
  onExport,
}: {
  chat: ChatListItem;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-1.5 rounded-md px-2.5 py-2 cursor-pointer transition-colors",
        isActive
          ? "bg-surface-muted text-ink"
          : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
      )}
      onClick={() => {
        setMenuOpen(false);
        onSelect();
      }}
    >
      <MessageSquare size={13} className="flex-shrink-0 text-ink-ghost" />
      <span className="flex-1 text-xs truncate leading-tight">{chat.title}</span>
      <div ref={menuRef} className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          aria-label="Chat actions"
          className={cn(
            "text-ink-ghost hover:text-ink transition-opacity p-0.5 rounded",
            "opacity-0 group-hover:opacity-100",
            menuOpen && "opacity-100"
          )}
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-36 rounded-md border border-surface-border bg-white shadow-lg z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onExport();
              }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-surface-muted text-ink-secondary"
            >
              Export JSON
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-surface-muted text-red-600"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
