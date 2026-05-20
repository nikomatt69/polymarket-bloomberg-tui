---
title: Installation
description: All installation paths — source, binary, global alias, and Bun global.
---

## Option 1 — Run From Source (Recommended For Development)

```bash
git clone https://github.com/nikomatt69/polytui-dashboard
cd polytui-dashboard
bun install
bun run dev
```

Changes to source files take effect on the next `bun run dev` invocation — there is no hot-reload in terminal mode.

## Option 2 — Install As Bun Global

```bash
bun install -g https://github.com/nikomatt69/polytui-dashboard
polytui-dashboard
```

This makes `polytui-dashboard` available system-wide via the `bin` entry in `package.json`.

## Option 3 — Build A Self-Contained Binary

```bash
bun run build
```

The compiled binary is output to `dist/` as a platform-specific archive. The binary name is `polytui-dashboard` and includes the Bun runtime — no separate Bun installation is required on the target machine.

Available build variants:

```bash
bun run build:single     # current platform
bun run build:baseline   # current platform, no AVX2
bun run build:all        # all platforms (linux-x64, darwin-arm64, darwin-x64, win32-x64)
```

Copy the binary to a directory in your `PATH`:

```bash
cp dist/polytui-dashboard-linux-x64/bin/polytui-dashboard ~/bin/
chmod +x ~/bin/polytui-dashboard
polytui-dashboard
```

## Option 4 — Shell Alias

For running from a cloned source directory without installing:

```bash
# in ~/.zshrc or ~/.bashrc
alias ptui='bun run /path/to/polytui-dashboard/src/index.tsx'
alias ptui-dev='cd /path/to/polytui-dashboard && bun run dev'
alias ptui-check='cd /path/to/polytui-dashboard && bun run type-check'
```

Reload your shell and run `ptui`.

## Verify Installation

Run with `--version` or `-v` to confirm:

```bash
polytui-dashboard --version
# 1.0.1
```

## Updating

From source:

```bash
git pull origin main
bun install
```

Binary: rebuild with `bun run build` and replace the old binary.

## Uninstalling

Remove the binary or alias you created. User data lives in `~/.polymarket-tui/` — remove that directory to reset all persisted state, wallet config, and alerts.

```bash
rm -rf ~/.polymarket-tui/
```

> **Warning:** this permanently deletes wallet credentials, alert definitions, watchlists, and chat sessions.
