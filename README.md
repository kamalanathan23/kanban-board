# Kanban Board Application

Kanban Board Application is a full-stack, responsive web app for organizing work with drag-and-drop columns, task details, comments, attachments, real-time updates, and role-based admin tools—built with React, Vite, Tailwind CSS, Radix UI, Express, and MongoDB.

## Live Preview

[View Live App](https://kanban-board-beryl-nine.vercel.app/)

## Screenshots

![Project board](https://raw.githubusercontent.com/kamalanathan23/kanban-board/refs/heads/main/frontend/src/assets/Project%20Board.png)

![Login screen](https://raw.githubusercontent.com/kamalanathan23/kanban-board/refs/heads/main/frontend/src/assets/login%20image.png)

## Tech Stack

**Frontend**

- React 18
- Vite 6
- Tailwind CSS 4
- Radix UI
- Redux Toolkit
- React Router
- Socket.IO Client
- TypeScript tooling

**Backend**

- Node.js
- Express 5
- MongoDB / Mongoose
- Socket.IO
- JWT authentication
- TypeScript

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))

### Install

**Backend**

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and set:

- `MONGODB_URI` — your MongoDB connection string
- `JWT_SECRET` — a long random secret (at least 32 characters)

Seed the default admin user:

```bash
npm run seed:admin
```

**Frontend**

```bash
cd frontend
npm install
```

### Run Locally

Start the API (from `backend/`):

```bash
npm run dev
```

The API runs on `http://localhost:4000`.

Start the UI (from `frontend/`):

```bash
npm run dev
```

The app runs on `http://localhost:3000`.

Default admin login (after seed):

| Field    | Value             |
| -------- | ----------------- |
| Email    | `admin@gmail.com` |
| Password | `admin123`        |

### Production Build

**Frontend** (from `frontend/`):

```bash
npm run build
```

Build artifacts are generated in the `frontend/dist/` folder.

**Backend** (from `backend/`):

```bash
npm run build
npm start
```

Compiled output is generated in the `backend/dist/` folder.

## Project Scripts

**Frontend** (`frontend/`)

- `npm run dev` — Start development server
- `npm run build` — Create production build

**Backend** (`backend/`)

- `npm run dev` — Start API with hot reload
- `npm run build` — Compile TypeScript
- `npm start` — Run compiled API
- `npm run seed:admin` — Create default admin user
