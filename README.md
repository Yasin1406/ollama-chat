<div align="center">

# 🦙 Ollama Chat

A full-stack, self-hosted LLM chat app powered by local Ollama models.

<p>
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Ollama-Local%20LLM-000000?style=for-the-badge" alt="Ollama" />
  <img src="https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk" alt="Clerk" />
</p>

</div>

## Architecture

```
ollama-chat/
├── backend/          # FastAPI REST API
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── middleware/   # Clerk JWT verification
│       ├── models/       # SQLAlchemy ORM
│       ├── routers/      # chats, messages, models
│       ├── schemas/      # Pydantic request/response models
│       └── services/     # Ollama HTTP client
└── frontend/         # Next.js 15 app
    └── src/
        ├── app/          # App Router pages
        ├── components/   # Sidebar, ChatWindow, MessageBubble
        ├── lib/          # API client, utils
        └── types/        # Shared TypeScript types
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | ≥ 3.11 |
| Node.js | ≥ 20 |
| PostgreSQL | ≥ 15 |
| Ollama | latest |

---

## Quick Start

### 1 — Ollama

```bash
# Install: https://ollama.com
# Start with CORS enabled so the API can reach it
OLLAMA_ORIGINS="*" ollama serve

# Pull a model (in another terminal)
ollama pull llama3.2
```

### 2 — PostgreSQL

```bash
sudo -u postgres psql
```

Inside the `psql` prompt:

```sql
CREATE USER dev WITH PASSWORD 'your_password';
CREATE DATABASE ollama_chat OWNER dev;
GRANT ALL PRIVILEGES ON DATABASE ollama_chat TO dev;

\c ollama_chat

GRANT ALL ON SCHEMA public TO dev;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dev;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO dev;
```

Exit `psql` with:

```bash
\q
```

### 3 — Clerk

1. Create a project at [clerk.com](https://clerk.com)
2. Copy the **Publishable key** and **Secret key**
3. Note your **JWKS URL** — it looks like:  
   `https://<your-subdomain>.clerk.accounts.dev/.well-known/jwks.json`

### 4 — Backend

```bash
cd backend
cp .env.example .env          # fill in your values
python3 -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend runs at **http://localhost:8000**  
Interactive docs (Swagger UI): **http://localhost:8000/docs**

### 5 — Frontend

```bash
cd frontend
cp .env.example .env.local    # fill in your Clerk keys
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## Environment Variables

### `backend/.env`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OLLAMA_BASE_URL` | Ollama server URL (default `http://localhost:11434`) |
| `CLERK_SECRET_KEY` | Your Clerk secret key (`sk_test_…`) |
| `CLERK_JWKS_URL` | Your Clerk JWKS URL |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |

### `frontend/.env.local`

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key |
| `CLERK_SECRET_KEY` | Your Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/chat` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/chat` |
| `NEXT_PUBLIC_API_URL` | Backend URL (default `http://localhost:8000/api`) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/chats/` | List all chats for the user |
| `POST` | `/api/chats/` | Create a new chat |
| `GET` | `/api/chats/:id` | Get a chat with all messages |
| `PATCH` | `/api/chats/:id/title` | Rename a chat |
| `DELETE` | `/api/chats/:id` | Delete a chat |
| `POST` | `/api/chats/:id/messages` | Send a message (SSE stream) |
| `GET` | `/api/models/` | List available Ollama models |
| `GET` | `/health` | Health check |

All endpoints (except `/health`) require a valid Clerk JWT in the `Authorization: Bearer <token>` header.

---

## Features

- 🔐 **Clerk authentication** — sign in / sign up, JWT-verified API calls  
- 🤖 **Ollama integration** — real-time streaming via SSE  
- 💬 **Persistent chat history** — per-user chats stored in PostgreSQL  
- 📋 **Markdown rendering** — code blocks with syntax highlighting  
- 🗂️ **Multi-chat sessions** — create, rename (auto), and delete conversations  
- 🎨 **Clean minimal UI** — matching the Ollama Chat design language  

---

## Production Notes

- Replace `Base.metadata.create_all()` with **Alembic** migrations  
- Use an environment variable for `ALLOWED_ORIGINS` in production  
- Run the backend behind a reverse proxy (nginx/Caddy) with HTTPS  
- Set `OLLAMA_ORIGINS` appropriately on your Ollama server  
