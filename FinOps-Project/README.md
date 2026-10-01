# CloudPulse FinOps

A multi-cloud **FinOps (Financial Operations)** web application. It gives you one place to see
what your cloud costs, what resources you own, and where the money is being wasted — across
**AWS, Azure and Google Cloud**.

Built with **React 18 + Vite 6 + Tailwind CSS 3**.

---

## What it does

- **Cost attribution** — every billing line item traced to the service, resource, team and
  cost centre that produced it.
- **Unified resource inventory** — a searchable register of every VM, cluster, bucket, database
  and serverless runtime across all three clouds, with owner, region, daily cost and live
  utilisation.
- **Budgets & forecasting** — month-to-date spend against budget, with an end-of-month forecast
  and burn rate per cost centre.
- **Savings recommendations** — idle, under-provisioned and unattached resources ranked by
  monthly saving, confidence and effort, with an accept/undo flow.
- **Anomaly detection** — spend spikes correlated back to the exact line items and resources
  that caused them.

---

## Prerequisites

You need **Node.js 20 LTS or newer** (Vite 6 requires `^18.0.0 || ^20.0.0 || >=22.0.0`).

Check your version:

```bash
node -v
npm -v
```

If you don't have Node.js, download the **LTS** installer from <https://nodejs.org> and install
it. It comes with `npm` bundled — you don't need to install npm separately.

---

## Running it on your laptop

### 1. Get the code

```bash
git clone https://github.com/sayamuddinshams/FinOps-Project.git
cd FinOps-Project
```

If you were sent a zip file instead, just unzip it and `cd` into the folder.

### 2. Install the dependencies

```bash
npm install
```

This downloads everything into a `node_modules/` folder. It only needs doing once — or any time
`package.json` changes.

### 3. Start the dev server

```bash
npm run dev
```

Your browser should open automatically at <http://localhost:5173>. If it doesn't, open that URL
manually.

### 4. Stop the server

Press `Ctrl + C` in the terminal.

---

## Pages to look at

| Route | What you'll see |
|---|---|
| `/` | Landing page — cost breakdown, resource inventory, savings queue (marketing mock data) |
| `/signup` | Sign-up, then a 6-digit email verification step |
| `/login` | Sign-in (tabs switch between Sign In and Create Account); verified accounts land on `/dashboard` |
| `/dashboard` | Protected. Lists your connected clouds, or an onboarding state with a link to `/connect` |
| `/connect` | Protected. Add/remove AWS, Azure and GCP credentials |

`/dashboard` and `/connect` redirect to `/login` without a valid session.

---

## All the commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (do this first) |
| `npm run dev` | Start the dev server with hot reload at `localhost:5173` |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build locally to check it |
| `npm test` | Run the full test suite (60 checks) |

---

## Project structure

```
src/
├── main.jsx                 Entry point — mounts React into the page
├── App.jsx                  Router: /, /signup, /login, /dashboard, /connect
├── index.css                Tailwind directives + shared button/table styles
│
├── api/
│   └── client.js            Fetch wrapper, token storage, single-flight refresh
│
├── auth/
│   ├── AuthContext.jsx      Session state: restore, adopt, sign out
│   └── RequireAuth.jsx      Redirects to /login when there is no session
│
├── hooks/
│   └── useCloudAccounts.js  Loads the signed-in user's cloud connections
│
├── data/
│   ├── finops.js            Landing-page sample data only (not used by the dashboard)
│   └── random.js            Seeded PRNG so mock data is identical every run
│
├── utils/
│   └── format.js            Currency and number formatting helpers
│
├── charts/                  (under components/) Hand-rolled SVG charts
│   ├── SpendTrendChart.jsx  Stacked area chart of spend by cloud
│   ├── Sparkline.jsx        Tiny inline trend line
│   └── ShareBar.jsx         Horizontal stacked share/progress bar
│
├── components/              Shared UI (Panel, StatusPill, DeltaChip, BrandLogo, …)
│   ├── auth/                Login + signup form pieces, incl. CodeInput
│   └── dashboard/           Dashboard sidebar and stat cards
│
└── pages/
    ├── Landing.jsx          The landing page
    ├── Dashboard.jsx        Authenticated dashboard (API data, no sample figures)
    ├── ConnectCloud.jsx     Add/remove cloud credentials
    └── Auth.jsx             Login / signup page

tests/
├── auth.smoke.jsx           22 checks for the login/signup page
└── finops.smoke.jsx         38 checks: landing, dashboard data boundaries, mock integrity
```

---

## Tech stack

| Tool | Version | Why |
|---|---|---|
| React | 18.3 | Component UI |
| Vite | 6.4 | Dev server and build tool (fast) |
| Tailwind CSS | 3.4 | Styling from a design system of colour/spacing tokens |
| React Router | 7.18 | Client-side routing between pages |
| PostCSS + Autoprefixer | 8.4 / 10.4 | Tailwind build pipeline |

**No chart library.** All charts (`SpendTrendChart`, `Sparkline`, `ShareBar`) are hand-written SVG,
so there's no extra dependency and the whole app is about 83 kB gzipped.

---

## Notes

**The landing page uses realistic sample data**, generated from a seeded random generator in
`src/data/finops.js`, so its charts look identical on every reload. It is marketing content only.

**The dashboard does not use it.** Sign-in requires a verified account, and `/dashboard` reads
exclusively from `GET /api/cloud-accounts`. With no cloud connected it shows an onboarding state; with
accounts connected it lists them and leaves the cost panels empty. Cost figures from AWS Cost
Explorer, Azure Cost Management and GCP Cloud Billing are the next stage — the panels say so instead
of inventing numbers.

**Auth is live.** Sign-up posts to `/api/auth/signup` and then requires the 6-digit code from
`/api/auth/verify-email`; sign-in posts to `/api/auth/signin` and redirects to `/dashboard`. Access
and refresh tokens are kept in `localStorage` under `cloudpulse.accessToken` / `cloudpulse.refreshToken`.
If the backend has no SMTP configured, the verification code is returned as `devCode` and shown on
screen so the flow is testable locally. See `../backend/README.md` for the API and database setup.

---

## Troubleshooting

**`npm: command not found`** (macOS/Linux) or **`npm is not recognized`** (Windows)
→ Node.js isn't installed or isn't on your PATH. Install the LTS build from <https://nodejs.org>
and reopen your terminal.

**`EADDRINUSE: port 5173 is already in use`**
→ Something else is on that port. Either stop it, or run `npm run dev -- --port 3000` and open
<http://localhost:3000>.

**Styles look broken / no colours**
→ Make sure `npm install` finished successfully. Tailwind is a build-time dependency — if it
didn't install, there's no CSS.

**`Failed to resolve import "@/..."`**
→ You're missing dependencies. Delete `node_modules` and `package-lock.json`, then run
`npm install` again.

**Page is blank after clicking a link**
→ Make sure you're running through `npm run dev`. If you open `dist/index.html` directly from the
file system, the client-side routes won't work.

**`/dashboard` bounces back to `/login`, or the dashboard stays on "Loading your accounts…"**
→ The backend isn't reachable on port 4000. Vite proxies `/api` there; check it with
`curl http://localhost:4000/health`, and start it with `npm start` inside `../backend`.

**Sign-in says the email is not verified**
→ Sign up first and enter the emailed code. With no SMTP configured locally, the code is printed in
the backend log and returned as `devCode` on the signup/resend response.

---

## Deploying (optional)

The app uses `BrowserRouter`, so your host needs to rewrite unknown paths to `index.html` —
otherwise a hard refresh on `/dashboard` or `/login` returns a 404.

- **Netlify** — create `public/_redirects` containing:
  ```
  /*  /index.html  200
  ```
- **Vercel** — create `vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- **GitHub Pages** — also set `base: '/FinOps-Project'` in `vite.config.js`, since Pages serves
  from a subpath.
