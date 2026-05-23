This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Quality Checks

Run these before merging:

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

Or run the full gate in one command:

```bash
npm run check
```

Maximum gate:

```bash
npm run check:full
```

## Notes Module Cron

The internal notes reminder runner is available at:

- `GET /api/internal/notes/reminders/run`
- `POST /api/internal/notes/reminders/run`

Set `NOTES_CRON_SECRET` or `CRON_SECRET` and send:

- `Authorization: Bearer <your secret>`

`vercel.json` schedules this route twice daily at `11:00 UTC` and `12:00 UTC`.
That covers `06:00` in `America/Chicago` across daylight saving time changes. The first run before the local send window skips, and the first run at or after `06:00` sends the daily summary once.

The job sends:

- task reminder emails when `notes_tasks.reminder_at` is due
- one daily summary email only when there is at least one active overdue or due-today task

## Rate Limiting

Public API routes (`/api/quote-public/*`, `/api/estimate-public/*`) and the
customer-send endpoint use `checkLocalRateLimit` from `lib/server/rateLimit.ts`.

**Current behaviour (default):** in-memory `Map` — fast, zero-config, but
*best-effort only*. Limits reset on every Vercel cold start and are not shared
across concurrent function instances, so a burst of traffic split across
instances can exceed the configured limit.

A warning is logged once per instance startup when running in `production` without
a persistent backend so the gap shows up in your logs.

### Upgrading to Upstash Redis (persistent, cross-instance)

Upstash offers a free tier and is the recommended upgrade path.

1. Create a free Redis database at [console.upstash.com](https://console.upstash.com).

2. Install the Upstash packages:
   ```bash
   npm install @upstash/ratelimit @upstash/redis
   ```

3. Set the environment variables (Vercel dashboard or `.env.local`):
   ```
   RATE_LIMIT_BACKEND=upstash
   UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

4. Replace the body of `checkLocalRateLimit` in `lib/server/rateLimit.ts` with the
   async Upstash implementation. Because `@upstash/ratelimit` calls are async, the
   function signature must change from synchronous to `async`, and every call site
   must add `await`. The parameter shape `{ key, max, windowMs }` and return shape
   `{ ok, remaining, resetAt }` stay the same. Call sites to update:

   - `app/api/estimate-public/[token]/route.ts`
   - `app/api/quote-public/[token]/route.ts`
   - `app/api/quote-public/[token]/accept/route.ts`
   - `app/api/quote-public/[token]/decline/route.ts`
   - `app/api/quote-public/[token]/pdf/route.ts`
   - `lib/server/estimateCustomerSendRoute.ts`

   The Vitest mock in `lib/server/__tests__/estimateCustomerSendRoute.test.tsx`
   must switch from `mockReturnValue` / `mockReturnValueOnce` to
   `mockResolvedValue` / `mockResolvedValueOnce`.

## Site Photos Canonical Endpoint

Use the site photos API as the canonical photo path:

- `GET /api/jobs/:id/site-photos`
- `POST /api/jobs/:id/site-photos`
- `PATCH /api/jobs/:id/site-photos/:photoId`
- `DELETE /api/jobs/:id/site-photos/:photoId`

Legacy `/api/jobs/:id/photos` has been removed.

If you previously stored closeout photos in `job_photos`, run:

- `supabase/sql/037_job_photos_backfill_to_site_photos.sql`

Backfill summary view:

- `public.v_job_photo_backfill_report`

If you previously connected Google before these scopes were added, go to `/crm/calendar` and:

1) Disconnect
2) Connect Google again

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
