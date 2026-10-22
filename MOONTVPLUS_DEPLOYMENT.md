# MoonTVPlus deployment

The existing MoonTV history is retained at the repository root. The Vercel application is the `moontvplus` Git submodule, pinned to MoonTVPlus 226.1.0 (`c7c5a3648025b24c5d7c0c13eaef148cf8b29b48`).

## Vercel moon-tv settings

- Root Directory: `moontvplus`
- Include source files outside Root Directory: enabled
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `node ../scripts/upgrade-backup.cjs && NEXT_PUBLIC_SITE_NAME="${NEXT_PUBLIC_SITE_NAME:-$SITE_NAME}" pnpm run build`
- Node.js: 22.x
- Existing USERNAME, PASSWORD, NEXT_PUBLIC_STORAGE_TYPE, UPSTASH_URL and UPSTASH_TOKEN are reused.

Before the first upgraded build, the backup script snapshots `admin:config` and all `u:*` keys into `upgrade-backup:moon-tv:20261022-v226.1.0:*` in the same Upstash database. Each record is gzip-compressed and AES-256-GCM encrypted using a key derived from the existing administrator PASSWORD and a random salt. It verifies each written backup before creating the completion manifest. No original keys are modified. Backup failure stops the build. Keep the password used during this upgrade for restoring this checkpoint. Do not delete backup keys until migration has been verified.

MoonTVPlus automatically migrates users, playback records and favorites on use. A deployment rollback alone does not reverse database migration. Restore data from the encrypted checkpoint if reverting to the old application after migration.

## Local use and future upgrades

```sh
git clone --recurse-submodules https://github.com/XiaozhuangXzsg/MoonTV.git
cd MoonTV/moontvplus
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test --runInBand
```

To upgrade again, fetch the upstream repository inside `moontvplus`, check out a reviewed commit, commit the new submodule pointer in this repository, and validate a preview before release. The upstream moving main branch is never deployed implicitly.

## Extra services

WebGPU super-resolution depends on browser/GPU support. AI, private libraries, notifications and similar integrations require their own configuration. A built-in WebSocket watch-room server and persistent server-side offline downloads cannot run inside Vercel Functions; use the documented external services for those features.
