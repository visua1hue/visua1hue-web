# visua1hue-web

Astro 7 site on Cloudflare Workers. Package manager and runtime: bun 1.4.5, pinned in `package.json` (`packageManager`).

## Commands

| command                 | does                                                                          |
| ----------------------- | ----------------------------------------------------------------------------- |
| `bun install`           | Install dependencies. CI uses `--frozen-lockfile`.                            |
| `bun run dev`           | Dev server.                                                                   |
| `bun run build`         | Production build into `dist/`.                                                |
| `bun run preview`       | Serve the built Worker on :8799. Run `bun run build` first.                   |
| `bun run preview:phone` | Same, over HTTPS on all interfaces, for testing on a phone. See below.        |
| `bun fmt`               | Format all files. `.astro` files go to Prettier with `prettier-plugin-astro`. |
| `bun fmt --check`       | Exit 1 if any file needs formatting.                                          |
| `bun run lint`          | oxlint with the rules in `.oxlintrc.json`. Warnings fail.                     |
| `bun run check`         | `astro check`: type checks `.ts` and `.astro`.                                |
| `bun run deploy`        | Build and deploy to production. Only on request.                              |

## Before every commit

Run `bun fmt`, `bun run lint` and `bun run check`. All must pass. No git hook runs them for you. CI (`.github/workflows/ci.yml`) runs the same steps plus `bun run build`.

## After every change

Run `bun run build`, restart the preview in the mode already running (`preview` or `preview:phone`), and confirm :8799 returns 200 before reporting back. Check `preview:phone` with `curl -k https://127.0.0.1:8799/`.

## Phone preview

`public/_headers` sends `upgrade-insecure-requests` and HSTS, so a phone on plain http gets its links and assets switched to https, which the http preview doesn't serve. `preview:phone` serves https with wrangler's self-signed certificate. Safari asks to accept it once.

- Phone: `https://<mac LAN IP>:8799` (`ipconfig getifaddr en0`).
- Mac: `https://127.0.0.1:8799`. Never `https://localhost`: Chrome stores the HSTS header for every localhost port and forces https on `bun run dev`. Browsers ignore HSTS for IP addresses. Fix: delete `localhost` at `chrome://net-internals/#hsts`.
- Reachable by anyone on the same network.

## Conventions

- Imports use the `@/` alias for `src/` (`@/components/PageFrame.astro`).
- Dev-only code lives in `src/dev/` and renders behind `import.meta.env.DEV`. The linter allows `console` there.
- `.prettierrc` sets the formatting (width 120). `bun fmt` reads it.
- `.oxlintrc.json` holds rules copied from `@cloudflare/oxlint-config` and `@nkzw/oxlint-config`, without type-aware rules. Don't add those packages as dependencies.
- `.git-blame-ignore-revs` lists the one-time format commit.
- Use `bun` and `bunx`. Never npm, npx, yarn or pnpm.
