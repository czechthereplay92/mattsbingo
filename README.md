# Matt's Alright Discord Bingo

A shared bingo board: anyone can flag a square when they hear the line in VC,
and an admin approves or denies it before it counts. Everyone sees the same
board update live (polls every 4 seconds).

## Deploy on Netlify

1. Push this folder to a GitHub repo (or drag-and-drop the whole folder into
   Netlify's manual deploy — either works, since the functions and config are
   already set up).
2. In Netlify: **Add new site → Import an existing project**, point it at the
   repo. Build settings are already defined in `netlify.toml`, so you can
   leave the build command blank and publish directory as `.`.
3. **Set the admin passcode**: Site settings → Environment variables → add
   `ADMIN_PASSCODE` with whatever passcode you want your admin(s) to use. If
   you skip this, it defaults to `changeme` — fine for testing, not for
   real use.
4. Deploy. Netlify Blobs works automatically on Netlify's own infrastructure
   — no separate database or API keys needed.

## How it works

- `netlify/functions/state.mjs` is the one API endpoint (mapped to `/api/state`
  via the redirect in `netlify.toml`). It stores everything in a Netlify Blobs
  store called `matt-bingo`.
- Anyone can `GET /api/state` (read board + pending claims) or submit a claim.
  Approving, denying, editing the phrase list, and reshuffling all require the
  `ADMIN_PASSCODE`.
- The admin passcode is stored in the browser's `sessionStorage` once entered
  — this is a lightweight gate for a small trusted group, not real
  authentication. Don't reuse a sensitive password for it.

## Customizing

- Default phrases live in `DEFAULT_PHRASES` inside
  `netlify/functions/state.mjs` — but easiest is to just use the in-app admin
  panel's "Phrases" tab once it's deployed.
- Colors and type are plain CSS in `index.html` under the `:root` block if you
  want to adjust the look.

## Local testing

You'll need the [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```
npm install
netlify dev
```

This runs the functions locally with a local Blobs emulator, at whatever port
the CLI prints (usually http://localhost:8888).
