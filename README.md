# Kanban Board Application

React + Vite frontend and Node/Express/MongoDB backend.

## Local setup

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set MONGODB_URI and a strong JWT_SECRET
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 (API proxied to http://localhost:4000).

## Environment variables (not in Git)

| File | Purpose |
|------|---------|
| `backend/.env` | `MONGODB_URI`, `JWT_SECRET`, `PORT` — **keep local only** |
| `frontend/.env` | Optional `VITE_API_BASE_URL` |

Copy from `.env.example` files; never commit real `.env` files.

## Publish to GitHub (first time)

### 1. Create an empty repository on GitHub

- Go to https://github.com/new
- Name it (e.g. `kanban-board`)
- **Do not** add README, .gitignore, or license (this project already has them)
- Create the repository and copy the remote URL

### 2. From the project root (PowerShell)

```powershell
cd "D:\AA\Kanban Board Application"

# Confirm secrets are ignored (should list backend/.env)
git check-ignore -v backend/.env

# Stage and commit
git add .
git status
# Verify: backend/.env, backend/uploads/, node_modules/ must NOT appear

git commit -m "Initial commit: Kanban board app"

# Link your GitHub repo (replace with your URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

git branch -M main
git push -u origin main
```

### 3. If you use SSH instead of HTTPS

```powershell
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## What must never be pushed

- `backend/.env` — database URL and JWT secret
- `backend/uploads/` — user file attachments
- Any file with passwords, API keys, or personal data
- `node_modules/` (reinstall with `npm install`)

## Already committed a secret by mistake?

1. Remove from Git history (or rotate the secret immediately).
2. Change `JWT_SECRET` and database password in production.
3. Use [GitHub secret scanning](https://docs.github.com/en/code-security/secret-scanning) on public repos.
