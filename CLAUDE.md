# visua1hue-web

Astro 7 site on Cloudflare Workers. Package manager and runtime: bun 1.4.5, pinned in `package.json` (`packageManager`).

## Commands

| command           | does                                                                          |
| ----------------- | ----------------------------------------------------------------------------- |
| `bun install`     | Install dependencies. CI uses `--frozen-lockfile`.                            |
| `bun run dev`     | Dev server.                                                                   |
| `bun run build`   | Production build into `dist/`.                                                |
| `bun run preview` | Serve the built Worker on :8799. Run `bun run build` first.                   |
| `bun fmt`         | Format all files. `.astro` files go to Prettier with `prettier-plugin-astro`. |
| `bun fmt --check` | Exit 1 if any file needs formatting.                                          |
| `bun run lint`    | oxlint with the rules in `.oxlintrc.json`. Warnings fail.                     |
| `bun run check`   | `astro check`: type checks `.ts` and `.astro`.                                |
| `bun run deploy`  | Build and deploy to production. Only on request.                              |

## Before every commit

Run `bun fmt`, `bun run lint` and `bun run check`. All must pass. No git hook runs them for you. CI (`.github/workflows/ci.yml`) runs the same steps plus `bun run build`.

## After every change

Run `bun run build`, restart `bun run preview`, and confirm :8799 returns 200 before reporting back.

## Conventions

- Imports use the `@/` alias for `src/` (`@/components/PageFrame.astro`).
- Dev-only code lives in `src/dev/` and renders behind `import.meta.env.DEV`. The linter allows `console` there.
- `.prettierrc` sets the formatting (width 120). `bun fmt` reads it.
- `.oxlintrc.json` holds rules copied from `@cloudflare/oxlint-config` and `@nkzw/oxlint-config`, without type-aware rules. Don't add those packages as dependencies.
- `.git-blame-ignore-revs` lists the one-time format commit.
- Use `bun` and `bunx`. Never npm, npx, yarn or pnpm.
