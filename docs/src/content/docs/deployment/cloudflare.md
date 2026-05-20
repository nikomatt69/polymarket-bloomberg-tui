---
title: Cloudflare Pages Deployment
description: Build and deploy the polytui-dashboard documentation site to Cloudflare Pages.
---

The docs site is a static Astro + Starlight build and deploys to Cloudflare Pages with zero configuration beyond build settings.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient).
- The repository pushed to GitHub (see `wrangler.toml` at the repo root).

## Automatic Deployment via GitHub Integration

1. Go to **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
2. Select the `nikomatt69/polytui-dashboard` repository.
3. Configure the build:

| Setting | Value |
| --- | --- |
| Build command | `bun install && bun run docs:build` |
| Build output directory | `docs/dist` |
| Root directory | *(leave blank)* |
| Node.js version | `20` |

4. Click **Save and Deploy**. Cloudflare will build and publish the site.

Every push to `main` (or your configured production branch) triggers an automatic redeploy.

## Manual Deployment via Wrangler CLI

Install Wrangler:

```bash
bun add -g wrangler
```

Authenticate:

```bash
wrangler login
```

Build the docs:

```bash
bun run docs:build
```

Deploy:

```bash
wrangler pages deploy docs/dist --project-name polytui-dashboard-docs
```

On first run, Wrangler creates the Pages project automatically.

## Local Preview With Wrangler

```bash
bun run docs:build
wrangler pages dev docs/dist
```

This runs a local Cloudflare Workers runtime that matches the production environment.

## Environment Variables

The docs site is fully static — it has no server-side runtime and requires no environment variables. If you add SSR features in the future, configure them under **Settings → Environment variables** in the Cloudflare dashboard.

## Custom Domain

1. In the Cloudflare dashboard, go to your Pages project → **Custom domains**.
2. Add your domain (e.g., `docs.polytui.io`).
3. Cloudflare auto-provisions SSL and sets up DNS if your domain is on Cloudflare.

## Caching

The `docs/public/_headers` file (committed in this repo) sets aggressive caching for immutable Astro assets:

```
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```

Page HTML is served without caching so new deploys are immediately visible.

## Preview Deployments

Every pull request automatically gets a preview URL from Cloudflare Pages, e.g.:

```
https://abc123.polytui-dashboard-docs.pages.dev
```

This is useful for reviewing docs changes before merging.

## Wrangler Configuration

The `wrangler.toml` at the root of the repository:

```toml
name = "polytui-dashboard-docs"
compatibility_date = "2025-05-20"
pages_build_output_dir = "docs/dist"

[build]
command = "bun install && bun run docs:build"
```

This is used by `wrangler pages deploy` and by CI pipelines that invoke Wrangler directly.
