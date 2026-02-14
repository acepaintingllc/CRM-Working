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
```

Or run the full gate in one command:

```bash
npm run check
```

## Google Estimate Sheets

To enable “Create estimate sheet” (copies a Google Sheets template and autofills customer/job fields), set:

- `GOOGLE_SHEETS_ESTIMATE_TEMPLATE_ID` (Spreadsheet file ID from `/d/<ID>/edit`)
- `GOOGLE_DRIVE_ESTIMATE_SHEETS_FOLDER_ID` (Destination folder for new sheet copies)
  - If unset, the app falls back to `GOOGLE_DRIVE_ESTIMATES_FOLDER_ID`.

### Template setup (named ranges)

In your template spreadsheet, keep labels like “Customer Name” as normal text. The app fills **cells that have Named ranges**:

- `customer_name` (required)
- `customer_address` (required)

Optional (filled only if you create these named ranges):

- `customer_email`, `customer_phone`
- `job_title`, `job_description`, `estimate_date`, `job_id`
- `customer_street`, `customer_city`, `customer_state`, `customer_zip`

To create a named range: select the value cell (e.g. `B4`) → **Data → Named ranges** → name it (e.g. `customer_name`).

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
