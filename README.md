# Orbit

**Your social circle, in perspective.** Created by **JD Regalario**.

Orbit is a dark-themed, privacy-first Instagram archive explorer. It compares follower and following lists locally, with no Instagram credentials, scraping, backend, analytics, or archive uploads.

## Run locally

Requirements: Node.js 22.12+ or 24 LTS and npm.

```sh
npm ci
npm run dev
npm test
npm run build
```

## Deploy to Vercel

1. Push this folder as its own GitHub repository.
2. Import that repository in Vercel.
3. Use the Vite preset, build command `npm run build`, output `dist`.
4. Deploy. No environment variables or database are required.

`vercel.json` includes security headers. Source and production assets are local; no external font or analytics services are used.

## Features

- ZIP import and multi-file JSON import, including split follower lists.
- Mutual connections, accounts not following back, accounts you do not follow, and optional pending requests.
- Username search, sorting, pagination, safe profile links, CSV export.
- Connection distribution and monthly following-timestamp charts with tooltips.
- Explicitly labeled fictional demo data.
- Up to five optional device-local snapshots, comparison, and individual deletion.
- Responsive dark interface, keyboard controls, native modal focus management, reduced-motion support.
- Background-worker parsing with limits on archive size, file count, and expanded JSON size.

## Instagram export instructions

Open Instagram settings, then Accounts Center (or Meta Account), **Your information and permissions**, and **Export your information** / **Download your information**. Choose one Instagram account, export to your device, customize information to **Followers and following**, set **JSON** and **All time**, and request the export. Labels and availability vary.

When ready, import the ZIP or select `following.json` and **every** `followers_*.json` together. They are commonly in `connections/followers_and_following/`. Optional `pending_follow_requests.json` is supported. HTML is not supported. For ZIPs over 250 MB, extract and select only the connection JSON files.

[Official Instagram export help](https://help.instagram.com/181231772500920)

## Data interpretation

Results reflect files, not live account state. An all-time export is necessary, but Orbit cannot prove the export is complete or determine its owner from connection files. Missing numbered follower parts are detected where possible; a missing final part cannot be inferred. Never combine accounts or export dates in one import.

A single snapshot identifies non-reciprocal follows, not unfollow events. Comparing two snapshots shows usernames added or absent. Renames, deactivation, incomplete data, or unfollows can all produce differences. Users choose export chronology manually; import time is not export time.

The timeline displays timestamps attached to **currently exported following records**, not historical follower totals or engagement. UTC months are used. No profile visitors, mute detection, or relationship scores are inferred.

## Privacy and storage

Imports stay in browser memory unless the user chooses to save a snapshot. Local snapshots are unencrypted in `localStorage`, limited to five, and readable by anyone with access to that browser profile. Clearing site data removes them. Hosting providers receive normal page-request metadata but not imported files.

The worker only decompresses supported connection files. Unrelated archive contents such as messages are ignored. Limits: 250 MB input, 40 MB per relevant JSON, 100 MB expanded connection data, up to 200 input files. These are protective limits, not promises that every device handles the maximum smoothly.

## Architecture

- React + TypeScript + Vite
- Recharts for interactive timeline
- fflate for selective ZIP decompression
- Dedicated worker for file parsing
- Pure analysis functions, validated before results are shown
- Vitest analysis tests and Playwright browser tests

## Platform roadmap

Instagram is the supported adapter. X/Twitter, TikTok, and Snapchat appear as planned, not working integrations. Add a separate parser and fixture suite per platform. X uses stable account IDs in its archive and must never execute archive JavaScript. TikTok categories differ by region and export. Snapchat friendship records require a different data model.

Suggested next stage: a shared platform adapter interface with platform-specific capabilities and provenance. Validate against consenting users' anonymized export fixtures before broadening compatibility. Current tests use synthetic fixtures; no real user archive is committed.

## Does it need Supabase?

No. The complete on-device workflow runs as a static Vercel app. Supabase becomes useful only if you choose user accounts, cross-device history, or collaboration later. That would change the privacy promise and require explicit consent, authentication, row-level access policies, retention/deletion controls, and a decision about client-side encryption. Avoid adding it just to store private archives.

## Public repository

Commit source, tests, and lockfile only. Do not commit personal Instagram archives. If GitHub CLI is available:

```sh
gh auth login
gh repo create orbit --public --source=. --remote=origin --push
```

## Attribution

Author: **JD Regalario**. Orbit is an independent project and is not affiliated with Instagram, Meta, X, TikTok, or Snap. No open-source license has been selected yet; public source visibility does not itself grant reuse rights.
