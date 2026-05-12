# Project Management API

Node.js + Express + PostgreSQL REST API with two-step OTP registration, JWT auth, role-based project access, and task management.

---

## Folder Structure

```
src/
├── config/
│   ├── db.js            # pg Pool + query wrapper + logger
│   ├── mailer.js        # Nodemailer transporter
│   └── migrate.js       # Run once: creates all tables
├── controllers/
│   ├── auth.controller.js
│   ├── project.controller.js
│   ├── task.controller.js
│   └── joinRequest.controller.js
├── middlewares/
│   └── index.js         # requestLogger, validate, authenticate, requireProjectRole, errorHandler
├── routes/
│   ├── index.js         # mounts all routers under /api
│   ├── auth.routes.js
│   ├── project.routes.js
│   └── user.routes.js   # /tasks/me, /join-requests/me
├── services/
│   ├── auth.service.js
│   ├── project.service.js
│   ├── task.service.js
│   └── joinRequest.service.js
├── utils/
│   ├── jwt.js           # sign / verify tokens
│   ├── logger.js        # coloured console logger
│   ├── otp.js           # generate, hash, email OTP
│   └── response.js      # standard { success, message, data } helpers
├── validators/
│   └── index.js         # express-validator rule sets
├── app.js               # Express app (CORS, rate limiting, routes)
└── server.js            # Entry point — DB connect → listen
```

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials and SMTP config
```

### 3. Create the database
```bash
psql -U postgres -c "CREATE DATABASE project_mgmt;"
```

### 4. Run migrations (creates all tables)
```bash
npm run db:migrate
```

### 5. Start the server
```bash
npm run dev       # development (nodemon)
npm start         # production
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default 5000) |
| `DB_*` | PostgreSQL connection details |
| `JWT_SECRET` | Secret for access tokens |
| `JWT_EXPIRES_IN` | Access token TTL e.g. `7d` |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `OTP_EXPIRES_MINUTES` | OTP validity window (default 10) |
| `SMTP_*` | Nodemailer SMTP credentials |
| `EMAIL_FROM` | Sender address |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |

> **Dev tip**: Use [Mailtrap](https://mailtrap.io) for SMTP — it catches all outgoing emails in a sandbox inbox.

---

## API Reference

All protected routes require:
```
Authorization: Bearer <access_token>
```

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Step 1: send OTP to email |
| POST | `/api/auth/verify-otp` | — | Step 2: verify OTP → create account + tokens |
| POST | `/api/auth/login` | — | Login → tokens |
| POST | `/api/auth/forgot-password` | — | Send password reset email |
| POST | `/api/auth/reset-password` | — | Reset password via email token |
| GET  | `/api/auth/me` | ✅ | Get own profile |
| PUT  | `/api/auth/me` | ✅ | Update own profile |
| PUT  | `/api/auth/change-password` | ✅ | Change password (requires current password) |

#### Register — Step 1
```json
POST /api/auth/register
{
  "first_name": "Ravi",
  "last_name": "Kumar",
  "email": "ravi@example.com",
  "password": "Secret123",
  "age": 25,
  "gender": "male",
  "phone_number": "+919876543210"
}
```

#### Register — Step 2
```json
POST /api/auth/verify-otp
{
  "email": "ravi@example.com",
  "otp": "481920"
}
```
Response includes `access_token`, `refresh_token`, and `user` object.

---

### Projects

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/projects?q=&page=&limit=` | ✅ | Search public projects |
| POST   | `/api/projects` | ✅ | Create project (becomes admin) |
| GET    | `/api/projects/me` | ✅ | My projects |
| GET    | `/api/projects/:projectId` | ✅ | Get project (private requires membership) |
| PUT    | `/api/projects/:projectId` | admin | Update project |
| DELETE | `/api/projects/:projectId` | admin | Delete project |

### Members

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/projects/:id/members` | member | List all members |
| DELETE | `/api/projects/:id/members/:userId` | admin | Remove member |
| PUT    | `/api/projects/:id/members/:userId/promote` | admin | Promote to admin |
| GET    | `/api/projects/:id/search-users?q=` | admin | Search users to invite |

### Join Requests

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/api/projects/:id/invite` | admin | Invite a user by ID |
| POST   | `/api/projects/:id/join` | ✅ | Request to join public project |
| GET    | `/api/projects/:id/requests` | admin | View pending requests |
| PUT    | `/api/projects/:id/requests/:rid` | admin | Accept or reject (`{ "action": "accepted" }`) |
| GET    | `/api/join-requests/me` | ✅ | My outbound requests |
| DELETE | `/api/join-requests/:id` | ✅ | Cancel my request |

### Tasks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/projects/:id/tasks` | member | All project tasks |
| POST   | `/api/projects/:id/tasks` | admin | Create task |
| GET    | `/api/projects/:id/tasks/stats` | member | Task stats (counts by status) |
| GET    | `/api/projects/:id/tasks/:tid` | member | Single task |
| PUT    | `/api/projects/:id/tasks/:tid` | admin | Update task |
| PUT    | `/api/projects/:id/tasks/:tid/assign` | admin | Assign to member |
| PUT    | `/api/projects/:id/tasks/:tid/complete` | member | Mark own task complete |
| DELETE | `/api/projects/:id/tasks/:tid` | admin | Delete task |
| GET    | `/api/tasks/me?status=&projectId=` | ✅ | My personal task list |

---

## Console Logging

Every request is logged with method, path, status code, duration, and user ID:

```
2025-06-01T10:23:01.123Z [REQUEST] → POST /api/auth/login
2025-06-01T10:23:01.145Z [AUTH] LOGIN → ravi@example.com
2025-06-01T10:23:01.210Z [DB] Query executed in 12ms | rows: 1
2025-06-01T10:23:01.310Z [REQUEST] 200 POST /api/auth/login (187ms | user: guest)
```

---

## Standard Response Shape

```json
{
  "success": true,
  "message": "Human readable message",
  "data": { ... },
  "meta": { "page": 1, "total": 42, "pages": 3 }
}
```

Error:
```json
{
  "success": false,
  "message": "What went wrong",
  "errors": [{ "field": "email", "message": "Valid email is required" }]
}
```
