import json
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.clerk_auth import get_current_user
from ..models.chat import Chat, Message
from ..schemas.chat import SendMessageRequest
from ..services.ollama import stream_chat

router = APIRouter(prefix="/chats", tags=["messages"])


@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: UUID,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Send a user message and stream the assistant reply via SSE.

    Event format:
      data: {"content": "<token>"}   — incremental token
      data: {"done": true}           — stream finished
      data: {"error": "<msg>"}       — something went wrong
    """
    chat = (
        db.query(Chat)
        .filter(Chat.id == chat_id, Chat.user_id == user_id)
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Persist user message immediately
    user_msg = Message(chat_id=chat_id, role="user", content=payload.content)
    db.add(user_msg)

    # Auto-title: use the first message (truncated) as the chat title
    existing_count = db.query(Message).filter(Message.chat_id == chat_id).count()
    if existing_count == 0:
        snippet = payload.content.strip()
        chat.title = snippet[:60] + ("…" if len(snippet) > 60 else "")

    # Remember the model actually used for this reply. Imported chats may carry a
    # model from another machine, and users can switch models at any time, so the
    # chat must not stay pinned to the model recorded in the exported JSON.
    model = payload.model or chat.model
    chat.model = model
    chat.updated_at = datetime.utcnow()
    db.commit()

    # Build history for Ollama
    history = [
        {"role": m.role, "content": m.content}
        for m in db.query(Message)
        .filter(Message.chat_id == chat_id)
        .order_by(Message.created_at)
        .all()
    ]

    async def event_generator():
        collected: list[str] = []
        try:
            async for chunk in stream_chat(model=model, messages=history):
                collected.append(chunk)
                yield f"data: {json.dumps({'content': chunk})}\n\n"

            # Persist full assistant reply
            full_reply = "".join(collected)
            assistant_msg = Message(
                chat_id=chat_id, role="assistant", content=full_reply
            )
            db.add(assistant_msg)
            chat.updated_at = datetime.utcnow()
            db.commit()
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
