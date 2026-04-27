# 🎤 Interview Platform (Full‑Stack MVP)

A fully deployed, end‑to‑end **role‑based interview platform** built with **React + Node.js + Supabase**, featuring a complete interview lifecycle from start to submission.

✅ Live frontend (Netlify)  
✅ Live backend (Render)  
✅ Live database (Supabase)

This project is a **production‑ready MVP** suitable for portfolio use or further extension (e.g. audio recording, admin review).

---

## 🚀 Live Demo

- **Frontend:** https://interview-2026.netlify.app  
- **Backend API:** https://interview-backend-hvec.onrender.com  

---

## 🧠 What This App Does

Candidates can:
1. Select a **role** (role ID enforced by backend)
2. Start an interview session
3. Answer dynamically loaded questions
4. Track progress throughout the interview
5. Submit the interview with confirmation
6. Receive a completion screen

The system ensures:
- One active interview per session
- No accidental refresh or back navigation during interview
- Final submission cannot be undone

---

## 🏗️ Architecture Overview
Frontend (React + Vite)
│
│ HTTPS
▼
Backend (Node.js + Express)
│
▼
Supabase (PostgreSQL)

### Frontend
- React + Vite
- State‑driven UI flow
- Deployed on Netlify

### Backend
- Node.js + Express
- REST API
- CORS‑secured
- Deployed on Render

### Database
- Supabase (PostgreSQL)
- Role‑based question storage

---

## 🔑 Core Features

- ✅ Role‑based interviews
- ✅ Dynamic question loading
- ✅ Interview lifecycle enforcement
- ✅ Progress indicator
- ✅ Submit confirmation
- ✅ Refresh / back‑navigation protection
- ✅ Production deployment

---

## 📡 API Endpoints

### GET `/api/roles`
Returns all available interview roles.

```json
[
  { "id": 1, "name": "Software Engineer" }
]


POST /api/interview/start
Starts a new interview session.
Request
JSON{  "email": "candidate@example.com",  "roleId": 1}Show more lines
Response
JSON{  "sessionId": "uuid",  "questions": [    { "id": 3, "text": "Explain event delegation." }  ]}Show more lines

POST /api/interview/submit
Finalizes the interview session.
Request
JSON{  "sessionId": "uuid"}Show more lines

🛡️ Security & Best Practices

Service role key used only on backend
.env excluded from version control
CORS restricted to Netlify frontend
No secrets exposed to client


🧪 Local Development
Backend
Shellnpm installnode app.jsShow more lines
Frontend
Shellnpm installnpm run dev``Show more lines

📦 Deployment

Frontend: Netlify
Backend: Render
Database: Supabase


🛣️ Roadmap (Phase 2)

🎙️ Audio recording per question
📂 Admin review dashboard
📊 Interview analytics
💾 Resume session after refresh


👤 Author
Built by Aman
GitHub: https://github.com/Amanhrcoordinator123

✅ Status: MVP Complete & Deployed

---

## ✅ How to add this to GitHub (2 minutes)

### Option A — On GitHub website (easiest)
1. Open your repo on GitHub
2. Click **Add file → Create new file**
3. Name it:

README.md
4. Paste the content above
5. Click **Commit**

### Option B — Locally
1. Create `README.md` in your project folder
2. Paste the content
3. Run:
```bash
git add README.md
git commit -m "Add README"
git push

