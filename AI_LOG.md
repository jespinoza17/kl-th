# AI_LOG

A running log of how AI tools were used throughout this take-home assignment.
Each entry captures **what** was done, **how AI was used**, and any **notes / decisions / tradeoffs**.

---

## Tooling

- **Primary assistant:** Claude (Opus 4.7) via Claude Code, running inside Conductor
- **Style of use:** pair-programming — I drive the requirements, AI executes and proposes; I review every change before commit

---

## Timeline

### Session start — 2026-05-22

**Goal:** Get the project running locally and set up the repo for the assignment.

- Verified the workspace contents and `package.json` (Next.js 16.1.6, React 18, Tailwind, Radix UI, react-hook-form, zod, luxon).
- Installed dependencies with `npm install` (227 packages).
- Started the dev server (`npm run dev`) and confirmed `GET / → 200` rendering the "Kaizen Wheels" homepage.
- Added `.gitignore` covering `node_modules/`, Next.js build caches (`.next/`, `out/`), env files, logs, OS/editor cruft, and TypeScript build info.
- Initialized this `AI_LOG.md` to document AI usage across the assignment.

**AI usage:** Claude handled the install/run verification, drafted the `.gitignore`, and scaffolded this log file. All commands and file contents were reviewed before commit.

**2-hour timer started at commit time.**

---

## Template for future entries

### <task / feature name> — <date / elapsed time>

**Goal:** <what we were trying to accomplish>

**AI usage:**
- <prompts or directions given>
- <what the AI produced>
- <what I changed / accepted / rejected and why>

**Notes:** <tradeoffs, follow-ups, things to revisit>
