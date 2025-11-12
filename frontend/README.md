<<<<<<< HEAD
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
=======
# Mahidol Forum Frontend

A responsive community portal built with React, TypeScript, Vite, Supabase Auth, and Supabase Database. The experience mirrors the supplied UI mock with the Mahidol colour palette (`#ffc952`, `#ff7473`, `#47b8e0`, `#34314c`).

## Getting Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Create an `.env` file (same directory as `package.json`) and provide the Supabase credentials:

   ```bash
   VITE_SUPABASE_URL=https://miwhruqwrhbppaxexptc.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pd2hydXF3cmhicHBheGV4cHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNzg0OTUsImV4cCI6MjA3Njc1NDQ5NX0.sWtOHZuBau1EVFMv5m1q4DF_0_A4cKqcMgNAb55RiTw
   ```

3. Run the development server

   ```bash
   npm run dev
   ```

   The app is available at `http://localhost:5173`.

## Key Features

- **Public forum browsing**: View threads, summaries, and replies without signing in.
- **Supabase authentication**: Email/password registration and login flows styled per design.
- **Thread creation & replies**: Logged-in members can start new discussions and reply inline.
- **LINE group applications**: Authenticated users can submit a verified request form; guests see a login/register prompt.
- **Responsive UI**: Header, hero, cards, and auth pages match the provided design direction and colour palette.

## Supabase Schema Expectations

The frontend assumes these tables exist (matching the architecture brief):

- `profiles` – stores `id`, `username`, and optional `avatar_url`.
- `threads` – stores discussion metadata (`title`, `summary`, `category`, `author_id`).
- `posts` – forum replies referencing `thread_id` and `author_id`.
- `line_applications` – keeps LINE group requests (`user_id`, `message`, `status`).

Authentication uses Supabase email/password auth with sessions persisted in the browser.

## Available Scripts

- `npm run dev` – start the Vite dev server.
- `npm run build` – create a production bundle.
- `npm run preview` – preview the production build locally.

## Folder Structure Highlights

- `src/components` – UI building blocks (layout, forum widgets, hero, LINE callout).
- `src/pages` – routed pages (`HomePage`, `ThreadPage`, `LoginPage`, etc.).
- `src/context/AuthContext.tsx` – session management via Supabase.
- `src/lib/supabase.ts` – Supabase client configuration with safe fallbacks.

Feel free to extend the forum with additional modules from the broader Mahidol platform plan (points, marketplace, admin dashboards) using the same project structure.
>>>>>>> a75f5eb428ad8805d757f662f46c7ecf77d2fd38
