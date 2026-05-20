# Kanban Board Application — Project & Functionality Guide

This document describes what the application does, how the pieces fit together, and how to run it. It is the single high-level reference for **behavior**, **architecture**, and **APIs**.

---

## 1. What This Project Is

A **full-stack Kanban board** where each signed-in user has a **personal board** stored in MongoDB. Users can manage columns and tasks, drag tasks between columns, add rich-text descriptions, comments, and file attachments, and (when allowed) pick **assignees** from the user directory.

The app distinguishes **regular users** from **admins**: non-admins only **see tasks assigned to themselves** on the board; admins see **all** tasks on their board. An **Admin** area manages users (CRUD, roles, active/inactive status).

**Realtime**: when the board is saved, the server notifies the same user’s Socket.IO room so other tabs (or clients) can refetch.

---

## 2. Tech Stack

### Frontend (`frontend/`)

| Area | Technology |
|------|------------|
| UI | React 18, Vite, TypeScript |
| State | Redux Toolkit, React Redux |
| Routing | React Router |
| Styling | Tailwind CSS |
| Components | Radix UI (dialogs, selects, popovers, etc.) |
| Drag & drop | `@dnd-kit` (tasks + column reordering) |
| Rich text | React Quill (task descriptions) |
| Notifications | Sonner |
| Realtime client | Socket.IO client |

### Backend (`backend/`)

| Area | Technology |
|------|------------|
| Runtime | Node.js, TypeScript |
| HTTP | Express 5 |
| Database | MongoDB + Mongoose |
| Auth | JWT (`Authorization: Bearer`), bcryptjs for passwords |
| Realtime | Socket.IO (HTTP server shared with Express) |
| Uploads | Multer; files on disk under `uploads/` |

---

## 3. Architecture Overview

### 3.1 Per-user board (not a shared team board)

- Each user’s board is stored under a unique key: **`user:<mongoUserId>:board`**.
- **GET /api/board** returns **that user’s** columns, tasks, and activity only.
- There is **no** shared “project” document: collaboration is modeled as **one board per user**; assignee names still reference people from the **User** collection for UI pickers.

### 3.2 Frontend state flow

1. After login, JWT is stored (Redux + localStorage).
2. **fetchBoard** loads the board from **GET /api/board**.
3. If the API returns **no columns** (empty array), the Redux slice falls back to **initialColumns** in `kanbanSlice` (local demo shape) until the server seeds; in practice the backend usually seeds before the first meaningful save.
4. **saveBoard** debounces and **PUT /api/board** persists the full column/task graph.
5. Socket **`board:updated`** triggers a refetch so multiple tabs stay in sync.

### 3.3 Roles

- **`user`**: default role after signup. Can use the Kanban board and assignee dropdown. **Board view** only lists tasks whose **`assignee`** matches their **name** or **email** (case-insensitive). Unassigned tasks and tasks assigned to others are **hidden** on the board.
- **`admin`**: sees **all** tasks on their own board. Can open **`/admin`** (Settings from the board header) and call **admin-only** APIs.

---

## 4. Core Features (Detailed)

### 4.1 Authentication

- **Sign up**: name, email, password (minimum length enforced server-side).
- **Login**: email + password → JWT.
- **Session**: JWT in `Authorization: Bearer`; **`/api/auth/me`** restores profile (name, email, role, status, etc.).
- On **401** from board or auth flows, the app can **logout** and prompt to sign in again.

### 4.2 Board load, save, and demo seeding

- **GET /api/board** (authenticated):
  - Loads the document for `user:<userId>:board`.
  - **Auto-seeds** a demo board when:
    - no board exists, or
    - columns are missing/empty, or
    - there are **no tasks**, or
    - the board still looks like the **old bundled demo** (assignees such as John Doe / Jane Smith from legacy frontend data), or
    - **`demoSeedVersion`** (stored on the board) is **older** than the current `DEMO_SEED_VERSION` **and** every task id still matches the **`demo-<userId>-<suffix>`** pattern (so **custom** boards are not overwritten).
  - Demo tasks are built in **`backend/src/demoBoard.ts`**: multiple **templates** (e.g. product, mobile, data, admin, marketing, DevOps) are chosen **deterministically** from a **hash of `userId`**, so **different users get different demo content**, not one identical list for everyone. Every demo task’s **`assignee`** is set to the **current user’s display name** (or email local-part) so non-admin filtering still shows them.
- **PUT /api/board** replaces `columns` and `activity` (and preserves other fields like `demoSeedVersion` unless Mongo overwrites paths—typically only sent fields update).

### 4.3 Assignees (user directory)

- **GET /api/users/assignees** (authenticated, **not** admin-only): returns active users `{ id, name, email }` for **assignee dropdowns**.
- **Create** and **edit task** modals and the **task details** sidebar use a **Select** fed by this list, plus **Unassigned** and optionally a **legacy** row if the task’s assignee string does not match any user (until the user picks a directory user).
- The list is **deduplicated** by id and email on the client; matching assignee strings to users is **case-insensitive** for name/email.

### 4.4 Tasks (CRUD + DnD)

- **Create**: from column or header “Add Task”; optional **attachments** on create (upload after task exists).
- **Edit**: task modal or task details popup.
- **Move**: drag-and-drop between columns; reorder columns horizontally.
- **Task card** shows priority, due date, tags, assignee initials, comment count, etc.

### 4.5 Task details popup

- Wide layout: **description** (rich text), **attachments**, **comments**, **metadata** (status column, priority, **assignee** with same dropdown behavior as modals, due date, labels).
- Status is implemented as **which column** the task belongs to (via column selector).

### 4.6 Rich text (React Quill)

- Description editing with toolbar (headings, lists, links, images, etc.) in **DescriptionEditor** / task details flow.

### 4.7 Comments

- Stored on the task; list shows author and timestamp; count on the card.

### 4.8 Attachments

- **POST /api/tasks/:taskId/attachments** — multipart `files`, saves under  
  `uploads/users/<userId>/tasks/<taskId>/...`  
  and metadata on the task in MongoDB.

### 4.9 Filters (board header)

- Search (title/description), priority, due date (overdue / today / week / none), **assignee substring** filter.
- **Clear filters** where applicable.

### 4.10 Columns

- Add, rename, reorder (dnd-kit). **Add column** may be restricted to admin in the UI (check current `KanbanBoard`).

### 4.11 Admin area (`/admin`)

- **GET/POST/PUT/DELETE** admin user routes (see API list): list users, create user, update profile, role, status, delete.
- Non-admins navigating to **`/admin`** are redirected to **`/`**.

---

## 5. API Reference (Summary)

### Public / health

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | `{ ok: true }` |

### Auth

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/signup` | name, email, password |
| POST | `/api/auth/login` | email, password → JWT + user |
| GET | `/api/auth/me` | `Authorization: Bearer` |

### Assignees (any authenticated user)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/users/assignees` | List `{ id, name, email }` for active users |

### Board (authenticated)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/board` | Load + optional demo seed (see §4.2) |
| PUT | `/api/board` | Save `columns` + `activity` |

### Task attachments

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/tasks/:taskId/attachments` | multipart `files` |

### Admin (JWT + role `admin`)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/admin/users` | List users |
| POST | `/api/admin/users` | Create user |
| PUT | `/api/admin/users/:id` | Update user fields |
| PUT | `/api/admin/users/:id/role` | Change role |
| PUT | `/api/admin/users/:id/status` | active / inactive |
| DELETE | `/api/admin/users/:id` | Delete user |

---

## 6. Data Models (Conceptual)

### User (`User`)

- `name`, `email`, `passwordHash`, `role` (`user` | `admin`), `status` (`active` | `inactive`), optional `phone`, `lastLoginAt`, timestamps.

### Board (`Board`)

- `key`: `user:<userId>:board` (unique)
- `columns[]`: each column has `id`, `title`, `color`, `tasks[]`
- Each **task**: `id`, `title`, `description`, `priority`, `assignee`, optional `dueDate`, `tags[]`, `attachments[]`, `comments[]`, …
- `activity[]`: feed items for the board UI
- `demoSeedVersion` (number): tracks auto-seeded demo template version for safe upgrades

---

## 7. Folder Structure (High Level)

```
Kanban Board Application/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express, auth, board, admin, uploads, Socket.IO
│   │   ├── demoBoard.ts      # Demo templates + buildDemoBoardColumns
│   │   ├── models/           # User, Board
│   │   └── seedAdmin.ts      # Optional admin seed
│   └── uploads/              # Runtime attachment storage
├── frontend/
│   └── src/
│       ├── App.tsx           # Auth + routes + KanbanBoard / AdminPage
│       ├── components/       # KanbanBoard, KanbanColumn, TaskCard, AdminPage, ...
│       └── store/            # authSlice, kanbanSlice
└── PROJECT_FUNCTIONALITY.md  # This file
```

---

## 8. Setup & Run

### Backend

```bash
cd backend
npm install
cp .env.example .env   # set MONGODB_URI, JWT_SECRET, PORT optional
npm run dev              # tsx src/index.ts — default port 4000
```

Required env: **`MONGODB_URI`**, **`JWT_SECRET`**. Optional: **`PORT`** (default `4000`).

### Frontend

```bash
cd frontend
npm install
npm run dev              # default http://localhost:3000
```

The frontend expects the API at **`http://localhost:4000`** (see `API_BASE_URL` in `kanbanSlice` / `authSlice`).

---

## 9. Troubleshooting

| Symptom | Things to check |
|--------|-------------------|
| Board empty for non-admin | Assignee on tasks must match **your name or email**; demo seed sets assignee to **you**; restart API and reload after seed changes. |
| Assignee dropdown empty / error | **GET /api/users/assignees** must exist; restart backend; valid JWT. |
| Attachments 404 | Backend running; port 4000; task exists on **your** board. |
| Mongo / save errors | MongoDB running; `.env` URI correct; logs in terminal. |

---

## 10. Future Documentation Splits (Optional)

If the project grows, this file can be split into:

- **`README.md`** — quick start only
- **`docs/API.md`** — request/response schemas
- **`docs/ARCHITECTURE.md`** — sequence diagrams (auth → fetch → save → socket)

---

*Last updated to reflect per-user boards, demo seeding (`demoBoard.ts`, `demoSeedVersion`), assignee endpoints, non-admin task visibility, and admin UI.*
