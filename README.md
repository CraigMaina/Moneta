# Moneta

A money manager for Kenya, built as a mobile-first PWA.

Paste an M-PESA message and Moneta fills out the transaction for you. It tracks your accounts and turns everything into one number: how much you can safely spend today. It also handles budgets, savings goals, recurring bills, and importing a full M-PESA statement so you can catch up on past spending.

## What it does

- Reads M-PESA SMS messages: paste one and it pulls out the amount, merchant, and whether money came in or went out. Pattern matching runs offline, with an LLM fallback for unusual formats.
- Gives you a daily safe-to-spend figure based on your pay cycle, income, bills, and what you have spent so far.
- Per-category budgets you can view by month or week.
- Savings goals with progress and a projected finish date.
- Recurring bills that feed into the safe-to-spend number.
- Spending insights by month or week.
- Statement import from a PDF or pasted text to backfill your history. PDFs are read on your device and the password never leaves it.
- Works offline and installs to the home screen.

## How money is handled

Amounts are stored as integer cents, never floating point. Transfers between your own accounts are never counted as income or spending. Balances are worked out from your transactions rather than stored. All dates use Africa/Nairobi time.

## Stack

React, TypeScript, Vite, Tailwind, and Framer Motion on the front end. Supabase (Postgres with row-level security, auth, and edge functions) on the back end. TanStack Query holds server state and persists it to IndexedDB for offline use.

## Running it

```bash
npm install
npm run dev      # dev server
npm run check    # typecheck, lint, tests
npm run build    # production build
```

You need a Supabase project. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a `.env` file, then apply the database migrations with `npx supabase db push`.
