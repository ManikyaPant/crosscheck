# CrossCheck web demo

See [the project README](../README.md) for setup, a demo walkthrough, and GitHub push instructions.

Run `npm ci` then `npm run dev`. The local dev server reads `SARVAM_API_KEY` from this directory's `.env` or the parent project's `.env`. The key is server-side only.

Endpoints:

- `GET /api/health`: liveness and key configuration status.
- `POST /api/compare`: JSON transcripts or multipart audio. Use `Accept: application/x-ndjson` for streamed stage updates.

Server implementation is in `server/`; UI is in `app/page.tsx`.
