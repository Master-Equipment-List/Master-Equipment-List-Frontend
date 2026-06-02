# MEL Studio — Frontend

Next.js 14 + TypeScript + Tailwind frontend for the Master Equipment List
backend. JWT auth, project-scoped workspaces, equipment grid with version
history, OneDrive browse/select/sync, file extraction JSON viewer, Excel export.

## Run

```bash
cp .env.local.example .env.local
# adjust NEXT_PUBLIC_API_BASE_URL if your backend isn't on :8000
npm install
npm run dev
```

App: <http://localhost:3000>. Backend must be running.

## Defaults

Login uses the credentials seeded by the backend:

- Email: `admin@example.com`
- Password: `ChangeMe123!`

## Pages

| Route | Purpose |
| --- | --- |
| `/login` | JWT login |
| `/projects` | List projects you have access to |
| `/projects/new` | Create a new Topside / Marine project |
| `/projects/:id` | Project dashboard (KPIs, distribution, totals) |
| `/projects/:id/equipment` | MEL grid — search/sort, click tag for detail |
| `/projects/:id/equipment/:eq` | Equipment detail + version history + diff |
| `/projects/:id/files` | Synced files list with category filter |
| `/projects/:id/files/:file` | File metadata + extracted JSON (text / tables / raw) |
| `/projects/:id/onedrive` | Browse, select items, run sync (per-file or bulk), see sync summary |
| `/projects/:id/versions` | Equipment by version count, jump to detail |
| `/projects/:id/team` | Project members + role management |
| `/projects/:id/settings` | Project metadata + OneDrive binding + delete |
| `/users` | Admin user management |
| `/admin/onedrive` | Org-level OneDrive OAuth connect |

## Stack

- Next.js 14 App Router + React 18 + TypeScript
- Tailwind CSS with the same `ink` / `brand` / `accent` palette as the reference site
- SWR for data fetching + revalidation
- `@tanstack/react-table` for the equipment grid
- `lucide-react` icons

## Wiring to backend

`lib/api.ts` reads `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000/api/v1`)
and attaches the JWT bearer token from `localStorage` on every request. On 401 it
tries the refresh token automatically, then redirects to `/login` if that fails.
