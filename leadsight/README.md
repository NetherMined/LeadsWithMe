# LeadSight app

This folder is the LeadSight Next.js application. Setup, configuration, OpenCode/Google setup and troubleshooting are in the [repository README](../README.md).

```bash
cp .env.example .env.local   # fill in the values
npm run docker:up            # full stack on http://localhost:3001
# or, for development:
npm install && npm run db:up && npm run db:migrate && npm run dev
```

Run `npm run check:secrets` before every push.
