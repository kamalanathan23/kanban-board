# Deploying Kanban Board

## Frontend on Vercel

1. **Root / preset:** Use **Services** (or frontend-only with Root Directory = `frontend`, preset **Vite**).
2. **Output directory:** `dist`
3. **Environment variables (Vercel → Settings → Environment Variables):**

| Key | Value | Notes |
|-----|--------|--------|
| `MONGODB_URI` | `mongodb+srv://...` from **MongoDB Atlas** | Not `127.0.0.1` |
| `JWT_SECRET` | Long random secret (32+ chars) | Same as local `.env` |
| `VITE_API_BASE_URL` | `/api` | When frontend + backend are on the same Vercel project |

4. **Redeploy** after adding env vars (required for the API to start).

## MongoDB Atlas (required for production)

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user and allow network access (`0.0.0.0/0` for testing).
3. Copy the connection string into `MONGODB_URI` on Vercel.

## Seed admin user in Atlas

From your machine (point `MONGODB_URI` at Atlas in `backend/.env`):

```bash
cd backend
npm run seed:admin
```

Default admin: `admin@gmail.com` / `admin123`

## If login still fails

- Open `https://YOUR-APP.vercel.app/api/health` — should return `{"ok":true}`, not a 500 crash page.
- Check **Vercel → Deployments → Functions / Logs** for `MONGODB_URI` or connection errors.
- **Recommended:** host the **backend** on [Render](https://render.com) or Railway (Express + Socket.io + file uploads work better there), then set on Vercel only:

  `VITE_API_BASE_URL=https://your-api.onrender.com/api`
