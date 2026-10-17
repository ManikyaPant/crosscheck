# CrossCheck demo

Compare two statements across languages using Sarvam Saaras v4 and Sarvam-105B. Record or upload audio (up to 30 seconds and 2 MB per statement), or type statements. Results include highlighted conflict quotes, clarification questions, agreements, and one-sided details. Transcripts can be corrected and compared again.

## Run the demo

Requires Node.js 22.13 or newer.

1. Copy `.env.example` to `.env` in this directory and set `SARVAM_API_KEY`. If your `.env` is already configured, keep it.
2. Install dependencies: `cd crosscheck`, then `npm ci`.
3. Run `npm run dev` from `crosscheck`, then open http://localhost:5173.

On the original Windows workspace, dependencies are installed. From the project root run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-demo.ps1
```

Load **A meeting, two times**, then click **Find the differences** for the Hindi/English demo. Examples are processed live. For recording, check the consent box and grant microphone access. Browser recording requires localhost or HTTPS.

## Minimal Python API test

```powershell
pip install sarvamai
python sarvam_chat.py
```

The script uses `sarvam-105b-conversations` and prints the reply. On the original workspace, Python is available at `.tools\python\python.exe`.

## Push to GitHub

Install Git for Windows first if `git` is not available. In this project directory:

```powershell
git init -b main
git add .gitignore .env.example README.md sarvam_chat.py start-demo.ps1 crosscheck
git status --short
git commit -m "Add CrossCheck demo and Sarvam API setup"
git remote add origin https://github.com/ManikyaPant/crosscheck.git
git push -u origin main
```

Sign in to GitHub when prompted. If Git asks for your author identity, set your own name/email with `git config user.name` and `git config user.email` and repeat the commit. If the remote already contains commits, clone it into a separate folder and copy these source files there before committing and pushing; do not force push.

`.env`, local runtimes, installed dependencies, and build output are excluded from Git. Verify the staged file list before committing. Never commit API keys.

## Scope

This is a demo. The API key stays on the server. The app processes audio in memory, forwards it to Sarvam, and keeps transcripts in browser memory while the page is open. It does not implement persistent history or accounts. Model confidence is an estimate. Audio is limited to the synchronous API; trim longer clips or use Sarvam Batch separately.

Basic local checks only; no claim of full accuracy evaluation or comprehensive browser testing.

## Vercel

Deploy the `crosscheck` directory using the Next.js framework. The included `vercel.json` selects `npm run build:vercel`. Configure `SARVAM_API_KEY` as a server-side production environment variable in Vercel. Never use a `NEXT_PUBLIC_` prefix. Audio uploads are limited to 2 MB per clip so the pair fits Vercel's request-size limit.
