# Baat — Minimalist Chat Interface

A calm, private place for conversations with the people who matter.

## Architecture & Directory Structure

```
├── backend/                  # Standalone backend service
│   ├── src/
│   │   └── server.ts         # Express API & WebSocket server
│   ├── package.json          # Backend dependencies & scripts
│   ├── schema.sql            # PostgreSQL schema (users, profiles, chats, messages)
│   └── tsconfig.json         # Backend TypeScript configuration
├── src/                      # Frontend React SPA
│   ├── components/           # UI components (buttons, dialogs, avatars, etc.)
│   ├── hooks/                # React hooks (e.g. use-mobile)
│   ├── lib/                  # Utilities & Baat API client
│   ├── App.tsx               # Main Baat application component
│   ├── index.css             # Tailwind v4 styles & design tokens
│   └── main.tsx              # React DOM entry point
├── server.ts                 # Full-stack dev & production server
├── index.html                # HTML entry point with DM Sans typography
├── render.yaml               # Single-service Render deployment blueprint
├── package.json              # Root package configuration
├── tsconfig.json             # Root TypeScript configuration
└── vite.config.ts            # Vite configuration with Tailwind v4 & React
```

## Features & Fixes Applied

- **Directory Organization**: Arranged cleanly into a unified full-stack architecture with a dedicated `backend/` and `src/` frontend.
- **Backend Error Resilience**:
  - `JWT_SECRET` has a secure dev fallback to prevent unhandled crash on startup when unset.
  - Graceful database initialization: connects to PostgreSQL when `DATABASE_URL` is provided, and automatically falls back to an in-memory store in local dev/testing without crashing.
  - Comprehensive `try/catch` error handling on all REST API endpoints.
  - WebSocket broadcast fix: messages now correctly compute `mine` per recipient so incoming messages are never falsely flagged as sent by the recipient.
  - UUID validation prevents Postgres syntax errors when non-UUID strings are queried.
- **Deployment**:
  - Streamlined `render.yaml` with straightforward `npm install && npm run build` and `npm start`.
  - Removed cyclical `postinstall` scripts that previously caused build race conditions.
  - Works out of the box in development with `npm run dev` (Vite middlewares on port 3000) and in production with `npm start`.

## Running the App

### Full-Stack (Default)
```bash
npm install
npm run dev
```

### Standalone Backend
```bash
cd backend
npm install
npm run dev
```
