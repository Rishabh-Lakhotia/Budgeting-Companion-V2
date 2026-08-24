# Wallet V2

A mobile-first AI personal finance companion built with Next.js, OpenAI Responses API, local browser persistence, Recharts, and browser voice recognition.

## Features

- Natural-language expense and income entry
- Smart defaults: today, bank/card by default, cash only when stated
- Context-aware finance questions
- Transaction editing/deletion through natural language
- Category memory
- Budget creation and coaching
- Savings goals
- Date-filtered category and trend charts
- Voice dictation
- Accounts and balances
- Import/export backups
- Orange/white mobile UI

## Run locally

1. Install Node.js 22+.
2. Copy `.env.example` to `.env.local`.
3. Put your OpenAI API key in `.env.local`:

   OPENAI_API_KEY=your_key_here

4. Run:

   npm install
   npm run dev

5. Open http://localhost:3000

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo into Vercel.
3. In Vercel → Project → Settings → Environment Variables, add:

   OPENAI_API_KEY = your OpenAI API key

4. Redeploy.

Never put the API key in a client-side `NEXT_PUBLIC_...` variable or commit it to GitHub.

## Important private-beta storage note

This version deliberately stores user finance data in browser `localStorage`, while the API key stays server-side. The app sends current state to the server only when the user asks the Wallet agent something.

That means:
- data survives refreshes on the same browser;
- it does not automatically sync across devices;
- clearing browser storage can remove it;
- use the Export feature for backups.

For a production multi-device version, move state to a database such as Postgres/Supabase/Neon and add authentication.
