from datetime import datetime
from typing import List, Optional, Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ── Message schemas ──────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    id: UUID
    chat_id: UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Chat schemas ─────────────────────────────────────────────────────────────

class ChatCreate(BaseModel):
    title: Optional[str] = "New Chat"
    model: Optional[str] = "llama3.2"


class ChatListItem(BaseModel):
    id: UUID
    title: str
    model: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatDetail(ChatListItem):
    user_id: str
    messages: List[MessageResponse] = []


# ── Import chat ─────────────────────────────────────────────────────────────

class ImportMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: Optional[datetime] = None


class ImportChat(BaseModel):
    title: Optional[str] = "Imported Chat"
    model: Optional[str] = "llama3.2"
    messages: List[ImportMessage] = Field(default_factory=list)


class ImportChatPayload(BaseModel):
    chat: Optional[ImportChat] = None
    title: Optional[str] = None
    model: Optional[str] = None
    messages: List[ImportMessage] = Field(default_factory=list)

    model_config = {"extra": "ignore"}


# ── Send message ─────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    content: str
    model: str = "llama3.2"
