# ✦ Doclify — Real-Time Collaborative Document Editor

A full-stack collaborative document editor built with React, Node.js, Socket.IO, and MongoDB. Think Google Docs, simplified and personalized.

---

## 🗂 Project Structure

```
doclify/
├── backend/                  # Node.js + Express + Socket.IO
│   ├── src/
│   │   ├── server.js         # Entry point
│   │   ├── models/
│   │   │   ├── User.js       # User schema (bcrypt passwords)
│   │   │   └── Document.js   # Document schema (versions, comments, collab)
│   │   ├── controllers/
│   │   │   ├── authController.js      # Register, login, me, logout
│   │   │   └── documentController.js  # Full CRUD + share + versions + comments
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── documents.js
│   │   │   └── users.js
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT protect + socketAuth
│   │   │   └── errorHandler.js
│   │   ├── socket/
│   │   │   └── socketHandlers.js  # All real-time collaboration logic
│   │   └── seed.js            # Demo data seeder
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                 # React 18 + React Router 6
│   ├── src/
│   │   ├── App.jsx            # Routes + auth guards
│   │   ├── index.js
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # Global auth state
│   │   ├── hooks/
│   │   │   └── useDocument.js     # Document state + socket events
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx       # Login + Register
│   │   │   ├── Dashboard.jsx      # Document list
│   │   │   └── EditorPage.jsx     # Full editor with toolbar + panels
│   │   ├── utils/
│   │   │   ├── api.js             # Axios client with JWT interceptors
│   │   │   └── socket.js          # Socket.IO singleton
│   │   └── styles/
│   │       └── globals.css        # CSS variables + shared tokens
│   ├── .env.example
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
└── docker-compose.yml        # One-command full stack startup
```

---

## 🚀 Quick Start

### Option A: Docker (Recommended)

```bash
git clone <your-repo>
cd doclify

# Start everything (MongoDB + Backend + Frontend)
docker-compose up --build

# Seed demo data
docker exec doclify-backend node src/seed.js
```

Visit: http://localhost:3000

---

### Option B: Manual Setup

#### 1. Prerequisites

- Node.js 18+
- MongoDB 6+ running locally (or a MongoDB Atlas URI)

#### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set MONGO_URI, JWT_SECRET, CLIENT_URL

npm install
npm run dev        # Starts on http://localhost:5000

# Optional: seed demo data
npm run seed
```

#### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env — set REACT_APP_API_URL, REACT_APP_SOCKET_URL

npm install
npm start          # Starts on http://localhost:3000
```

---

## 🔐 Demo Accounts (after seeding)

| Email                  | Password      | Role  |
|------------------------|---------------|-------|
| alice@doclify.app      | password123   | Owner |
| bob@doclify.app        | password123   | Editor|
| sara@doclify.app       | password123   | Viewer|

---

## 🔌 API Reference

### Auth
| Method | Endpoint                  | Description           |
|--------|---------------------------|-----------------------|
| POST   | /api/auth/register        | Create account        |
| POST   | /api/auth/login           | Login → returns JWT   |
| GET    | /api/auth/me              | Get current user      |
| POST   | /api/auth/logout          | Logout                |
| PUT    | /api/auth/update-password | Change password       |

### Documents
| Method | Endpoint                              | Description               |
|--------|---------------------------------------|---------------------------|
| GET    | /api/documents                        | List your documents       |
| POST   | /api/documents                        | Create document           |
| GET    | /api/documents/:id                    | Get document              |
| PUT    | /api/documents/:id                    | Update (auto-saves version)|
| DELETE | /api/documents/:id                    | Delete (owner only)       |
| POST   | /api/documents/:id/share              | Invite collaborator       |
| DELETE | /api/documents/:id/collaborators/:uid | Remove collaborator       |
| POST   | /api/documents/:id/share-link         | Generate public link      |
| GET    | /api/documents/shared/:token          | Open shared doc (no auth) |
| GET    | /api/documents/:id/versions           | Version history           |
| POST   | /api/documents/:id/restore/:vid       | Restore a version         |
| POST   | /api/documents/:id/comments           | Add comment               |
| DELETE | /api/documents/:id/comments/:cid      | Delete comment            |

### Health
| Method | Endpoint     | Description |
|--------|--------------|-------------|
| GET    | /api/health  | Server status |

---

## 🔄 Socket.IO Events

### Client → Server
| Event          | Payload                            | Description              |
|----------------|------------------------------------|--------------------------|
| `doc:join`     | `{ docId }`                        | Join a document room     |
| `doc:leave`    | `{ docId }`                        | Leave a document room    |
| `doc:change`   | `{ docId, content, title }`        | Broadcast content change |
| `doc:save`     | `{ docId, content, title }`        | Manual save              |
| `cursor:move`  | `{ docId, position, selection }`   | Broadcast cursor position|
| `user:typing`  | `{ docId, isTyping }`              | Typing indicator         |
| `comment:add`  | `{ docId, text }`                  | Add comment via socket   |

### Server → Client
| Event            | Payload                            | Description                  |
|------------------|------------------------------------|------------------------------|
| `doc:change`     | `{ docId, content, title, sentBy }`| Remote user's changes        |
| `doc:saved`      | `{ docId, savedAt, wordCount }`    | Confirmed save               |
| `presence:init`  | `{ docId, users }`                 | Initial presence list        |
| `presence:update`| `{ docId, users }`                 | Presence changed             |
| `cursor:move`    | `{ socketId, name, color, position }`| Remote cursor moved        |
| `user:left`      | `{ socketId, name }`               | User left the room           |
| `comment:new`    | `{ docId, comment }`               | New comment added            |

---

## ✨ Features

- **Real-time collaboration** — Socket.IO rooms per document
- **Live cursor tracking** — see other users' cursor positions
- **Auto-save** — debounced 3s after last keystroke, saves to MongoDB
- **Version history** — last 20 auto-saves, manual restore
- **Rich text editor** — bold, italic, headings, lists, links, alignment
- **Export** — download as .txt, .html, or .md
- **Document sharing** — invite by email or generate public link
- **Comments** — real-time threaded notes
- **JWT authentication** — secure, stateless
- **Dark & Light theme** — persisted to localStorage
- **Presence indicators** — colored avatars per collaborator

---

## 🛠 Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18, React Router 6          |
| Real-time   | Socket.IO 4                       |
| HTTP Client | Axios                             |
| Backend     | Node.js, Express 4                |
| Database    | MongoDB + Mongoose 8              |
| Auth        | JWT (jsonwebtoken) + bcryptjs     |
| Container   | Docker + Docker Compose           |
| Proxy       | Nginx (production frontend)       |

---

## 🔧 Environment Variables

### Backend `.env`
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/doclify
JWT_SECRET=your_strong_secret_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

### Frontend `.env`
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

---

## 📦 Production Deployment

1. Set `NODE_ENV=production` and a strong `JWT_SECRET`
2. Use MongoDB Atlas for the database
3. Set `CLIENT_URL` to your actual frontend domain
4. Build frontend: `npm run build` — serves static files via Nginx
5. Use PM2 or a process manager for the Node backend
6. Add HTTPS via Certbot / Cloudflare

---

## 🗺 Roadmap (Optional Enhancements)

- [ ] Operational Transform (OT) or CRDT for true conflict-free merging
- [ ] Redis adapter for Socket.IO (horizontal scaling)
- [ ] Email notifications for invites (Nodemailer / SendGrid)
- [ ] PDF export (Puppeteer)
- [ ] Google OAuth login
- [ ] Offline mode (Service Worker + IndexedDB)
- [ ] Document templates
- [ ] @mention in comments

---

Made with ✦ by Doclify

🖼 Screenshots

Dashboard
![Dashboard](screenshots/dashboard.png)

Editor — Dark Theme
![Editor Dark](screenshots/dark-theme.png)

Editor — Light Theme
![Editor Light](screenshots/light-theme.png)

Real-Time Collaboration
![Collaboration](https://github.com/Akshta31/doclify---Real-Time-Collaborative-Text-Editor/blob/cb9d36b796fa06eac9ddfe249989ce877ba159ad/screenshotss/collab.png)
