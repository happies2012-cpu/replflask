# GuideSoft — Nine Worlds Hub

A premium full-stack platform that connects nine domains (Technology, Education, Health, Finance, E-Commerce, Travel, Business, Entertainment, Jobs) into a single, modern web app.

## Stack
- **Backend:** Flask 3 (Python 3.10) + SQLite3 (built-in, file: `guidesoft.db`)
- **Frontend:** React 18 (via CDN) + Babel (in-browser transform) + Tailwind CSS (CDN)
- **Auth:** Replit Auth (X-Replit-User-* headers, auto user creation in DB)
- **Routing:** Hash-based client-side router (no build step)

## Run
```bash
python3 main.py     # serves http://0.0.0.0:5000
```
Workflow: **Start application** → `python3 main.py` (port 5000, webview).

## Folder Structure
```
main.py                # Flask app, all routes & API endpoints, DB schema & seed
templates/index.html   # SPA shell, theme bootstrap, React/Tailwind CDN loaders
static/js/app.jsx      # Full React SPA: providers, router, layout, all 9 pages
static/css/app.css     # Glassmorphism, neo-brutal, animations, scrollbar
guidesoft.db           # SQLite database (auto-created, seeded on first run)
```

## Pages (9)
Home, Dashboard, Technology, Jobs, Search, Payment, Entities, Content, UserActivity

## API Routes
- `GET  /api/auth/me` · `POST /api/auth/update-theme`
- `GET  /api/dashboard/stats`
- `GET/POST /api/projects` · `GET/PUT/DELETE /api/projects/<id>`
- `GET/POST /api/tasks` · `GET/PUT/DELETE /api/tasks/<id>` · `POST /api/tasks/<id>/comments`
- `GET/POST /api/content` · `GET/PUT/DELETE /api/content/<id>` · `POST /api/content/<id>/like`
- `GET/POST /api/jobs` · `POST /api/jobs/<id>/apply`
- `GET/POST /api/entities` · `PUT/DELETE /api/entities/<id>`
- `GET  /api/activity` · `GET /api/notifications` · `POST /api/notifications/<id>/read`
- `POST /api/payments/initiate` · `POST /api/payments/confirm`
- `GET  /api/users/profile` · `PUT /api/users/profile`
- `GET  /api/search?q=` · `GET /api/tech/stats`

## Database Tables
users, projects, tasks, comments, content_items, jobs, job_applications, entities, activity_log, notifications, payments

## Features
- Real-time theme toggle (system-aware, persists in localStorage + DB)
- Mobile + desktop responsive sidebar
- Search across content/jobs/orgs with grouped results
- Kanban board with status transitions
- Modal-based forms (create projects, tasks, content, jobs, orgs)
- Activity log with pagination
- Subscription plans with simulated payment flow
- Toast notifications, skeleton loaders, empty states
