# MockTest — Admin Panel (separate app)

The MockTest admin panel as its own project, on its own port, apart from the student website.

| App | Folder | Port |
|---|---|---|
| Student website | `mocktest-web-main/` | 3000 |
| **Admin panel** | `admin-panel/` (this) | **3001** |
| Admin access server | `server-for-admin-panel-/` | 4000 |

## Run
1. Start the admin access server: `cd ../server-for-admin-panel-` → `npm run dev`.
   Its `.env` must allow this app: `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001`.
2. Here: `npm install` (once) → `npm run dev` → <http://localhost:3001>.

`.env.development` (local, gitignored) holds the same `VITE_*` values as the website — see `.env.example`.

## Sign in
Email + password only. Admin accounts are created by the super admin in **Admin Control**.
A new admin first signs in with the temporary password and must set their own permanent password.

## Build
`npm run build` → `dist/`.

## Note
`src/pages/AdminPage.jsx`, `src/components/admin/*` and `src/access/*` are copies of the website's files.
A change to one copy is not applied to the other automatically.
