import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import solidJs from "@astrojs/solid-js";

export default defineConfig({
  output: "static",
  integrations: [
    solidJs(),
    starlight({
      title: "polytui-dashboard",
      description:
        "Bloomberg-style terminal dashboard for Polymarket prediction markets. Built with Bun, SolidJS, and OpenTUI.",
      lastUpdated: true,
      favicon: "/favicon.svg",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/nikomatt69/polytui-dashboard",
        },
      ],
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },
      expressiveCode: {
        styleOverrides: {
          borderRadius: "0.45rem",
        },
      },
      head: [
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.googleapis.com",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: "anonymous",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Space+Grotesk:wght@400;500;600;700&display=swap",
          },
        },
        {
          tag: "style",
          content: `
/* ── Design tokens ───────────────────────────────────────────── */
:root {
  --sl-content-width: 49rem;
  --sl-sidebar-width: 20rem;
  --sl-nav-height: 3.8rem;
  --sl-font: "Space Grotesk", system-ui, sans-serif;
  --sl-font-mono: "JetBrains Mono", "Fira Code", monospace;
  /* dark-mode palette */
  --sl-color-black: hsl(0, 0%, 3%);
  --sl-color-gray-6: hsl(0, 0%, 5%);
  --sl-color-gray-5: hsl(0, 0%, 9%);
  --sl-color-gray-4: hsl(0, 0%, 24%);
  --sl-color-gray-3: hsl(0, 0%, 52%);
  --sl-color-gray-2: hsl(0, 0%, 84%);
  --sl-color-gray-1: hsl(0, 0%, 96%);
  --sl-color-bg: hsl(0, 0%, 3%);
  --sl-color-bg-nav: hsla(0, 0%, 4%, 0.94);
  --sl-color-bg-sidebar: hsl(0, 0%, 4%);
  --sl-color-bg-inline-code: hsl(0, 0%, 8%);
  --sl-color-hairline: hsl(0, 0%, 13%);
  --sl-color-hairline-light: hsl(0, 0%, 20%);
  --sl-color-accent-low: hsl(197, 100%, 12%);
  --sl-color-accent: hsl(197, 100%, 56%);
  --sl-color-accent-high: hsl(194, 100%, 86%);
  --sl-color-text: hsl(0, 0%, 86%);
  --sl-color-text-accent: hsl(197, 100%, 74%);
  --sl-color-text-invert: hsl(0, 0%, 3%);
  --sl-color-bg-accent: hsl(197, 100%, 56%);
  --sl-color-backdrop-overlay: hsla(0, 0%, 2%, 0.82);
  --sl-shadow-sm: 0 1px 2px hsla(197, 100%, 52%, 0.08), 0 2px 12px hsla(197, 100%, 52%, 0.1);
  --sl-shadow-md: 0 8px 24px hsla(197, 100%, 52%, 0.12);
  --sl-shadow-lg: 0 14px 46px hsla(197, 100%, 52%, 0.16);
  --sl-color-orange-low: hsl(197, 100%, 12%);
  --sl-color-orange: hsl(197, 100%, 56%);
  --sl-color-orange-high: hsl(194, 100%, 86%);
  --sl-color-green-low: hsl(155, 100%, 10%);
  --sl-color-green: hsl(155, 90%, 48%);
  --sl-color-green-high: hsl(152, 100%, 82%);
  --sl-color-red-low: hsl(355, 100%, 12%);
  --sl-color-red: hsl(355, 90%, 58%);
  --sl-color-red-high: hsl(355, 100%, 84%);
  --sl-color-blue-low: hsl(215, 100%, 12%);
  --sl-color-blue: hsl(215, 100%, 56%);
  --sl-color-blue-high: hsl(215, 100%, 86%);
}

:root[data-theme='light'] {
  --sl-color-black: hsl(0, 0%, 100%);
  --sl-color-gray-7: hsl(210, 45%, 99%);
  --sl-color-gray-6: hsl(210, 36%, 97%);
  --sl-color-gray-5: hsl(213, 28%, 90%);
  --sl-color-gray-4: hsl(216, 17%, 62%);
  --sl-color-gray-3: hsl(217, 17%, 40%);
  --sl-color-gray-2: hsl(221, 28%, 20%);
  --sl-color-gray-1: hsl(223, 35%, 11%);
  --sl-color-bg: hsl(0, 0%, 100%);
  --sl-color-bg-nav: hsla(0, 0%, 100%, 0.94);
  --sl-color-bg-sidebar: hsl(0, 0%, 100%);
  --sl-color-bg-inline-code: hsl(211, 44%, 96%);
  --sl-color-hairline: hsl(214, 30%, 86%);
  --sl-color-hairline-light: hsl(214, 34%, 92%);
  --sl-color-accent-low: hsl(206, 100%, 93%);
  --sl-color-accent: hsl(206, 98%, 48%);
  --sl-color-accent-high: hsl(212, 87%, 30%);
  --sl-color-text: hsl(218, 18%, 35%);
  --sl-color-text-accent: hsl(212, 85%, 32%);
  --sl-color-text-invert: hsl(0, 0%, 100%);
  --sl-color-bg-accent: hsl(206, 98%, 48%);
  --sl-color-backdrop-overlay: hsla(215, 28%, 28%, 0.42);
}

/* ── Base typography ─────────────────────────────────────────── */
html, body {
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body { letter-spacing: 0.005em; }

/* ── Background gradients ────────────────────────────────────── */
html[data-theme='dark'] body {
  background:
    radial-gradient(1150px 360px at 14% -18%, hsla(197, 100%, 56%, 0.14), transparent 66%),
    radial-gradient(720px 260px at 86% -14%, hsla(197, 100%, 56%, 0.08), transparent 68%),
    var(--sl-color-bg);
}

html[data-theme='light'] body {
  background:
    radial-gradient(950px 360px at 20% -20%, hsla(206, 100%, 52%, 0.11), transparent 64%),
    radial-gradient(700px 300px at 88% -12%, hsla(212, 95%, 54%, 0.08), transparent 62%),
    var(--sl-color-bg);
}

/* ── Nav / header ────────────────────────────────────────────── */
.header {
  backdrop-filter: saturate(150%) blur(12px);
  -webkit-backdrop-filter: saturate(150%) blur(12px);
  border-bottom-color: color-mix(in hsl, var(--sl-color-accent) 24%, var(--sl-color-hairline));
}

.sidebar-pane {
  background:
    linear-gradient(180deg, color-mix(in hsl, var(--sl-color-accent-low) 14%, transparent), transparent 24%),
    var(--sl-color-bg-sidebar);
}

.site-title { letter-spacing: 0.01em; }

button[data-open-modal] {
  border-radius: 0.75rem;
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}

button[data-open-modal]:hover {
  box-shadow: 0 8px 20px color-mix(in hsl, var(--sl-color-accent) 22%, transparent);
  transform: translateY(-1px);
}

/* ── Prose improvements ──────────────────────────────────────── */
html:not([data-has-hero]) .sl-markdown-content > p:first-of-type {
  font-size: clamp(1.02rem, 0.97rem + 0.25vw, 1.16rem);
  line-height: 1.75;
  color: color-mix(in hsl, var(--sl-color-text) 90%, var(--sl-color-accent-high));
  max-width: 70ch;
}

html:not([data-has-hero]) .sl-markdown-content > * + * { margin-top: 1.05rem; }
html:not([data-has-hero]) .sl-markdown-content h2 { margin-top: 2.1rem; }
html:not([data-has-hero]) .sl-markdown-content h3 { margin-top: 1.35rem; }

.sl-markdown-content li + li { margin-top: 0.32rem; }

.sl-markdown-content table tbody tr:nth-child(even) {
  background: color-mix(in hsl, var(--sl-color-accent-low) 9%, transparent);
}

/* ── Guide callout blocks ────────────────────────────────────── */
.sl-markdown-content .guide-intro {
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 30%, var(--sl-color-hairline));
  border-radius: 0.72rem;
  padding: 0.75rem 0.9rem;
  background:
    linear-gradient(180deg, color-mix(in hsl, var(--sl-color-accent-low) 20%, transparent), transparent 62%),
    color-mix(in hsl, var(--sl-color-black) 95%, var(--sl-color-accent-low));
}

.sl-markdown-content .guide-intro strong {
  color: color-mix(in hsl, var(--sl-color-white) 90%, var(--sl-color-accent-high));
}

.sl-markdown-content .guide-nav {
  margin-top: 1.4rem;
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 26%, var(--sl-color-hairline));
  border-radius: 0.72rem;
  padding: 0.7rem 0.85rem;
  background: color-mix(in hsl, var(--sl-color-accent-low) 13%, transparent);
}

.sl-markdown-content .guide-nav p { margin: 0; font-size: var(--sl-text-sm); }
.sl-markdown-content .guide-nav a { font-weight: 600; }

/* ── KPI grids ───────────────────────────────────────────────── */
.sl-markdown-content .guide-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
  margin: 0.7rem 0 1rem;
}

.sl-markdown-content .guide-kpi-item {
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 24%, var(--sl-color-hairline));
  border-radius: 0.64rem;
  padding: 0.58rem 0.7rem;
  background: color-mix(in hsl, var(--sl-color-black) 95%, var(--sl-color-accent-low));
}

.sl-markdown-content .guide-kpi-item span {
  display: block;
  font-size: var(--sl-text-2xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in hsl, var(--sl-color-text) 74%, var(--sl-color-accent-high));
}

.sl-markdown-content .guide-kpi-item strong {
  display: block;
  margin-top: 0.18rem;
  font-size: var(--sl-text-sm);
  color: color-mix(in hsl, var(--sl-color-white) 90%, var(--sl-color-accent-high));
}

/* ── Headings ────────────────────────────────────────────────── */
.sl-markdown-content h2 { position: relative; padding-bottom: 0.35rem; }

.sl-markdown-content h2::after {
  content: "";
  position: absolute;
  inset-inline-start: 0;
  bottom: 0;
  width: clamp(5.4rem, 18vw, 9rem);
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--sl-color-accent), color-mix(in hsl, var(--sl-color-accent-high) 55%, transparent));
}

.sl-markdown-content h3 {
  color: color-mix(in hsl, var(--sl-color-white) 78%, var(--sl-color-accent-high));
}

.sl-markdown-content a:not(.sl-link-card a):not(.sl-link-button) {
  text-decoration-thickness: 1.5px;
  text-underline-offset: 0.18em;
}

/* ── Inline code and blocks ──────────────────────────────────── */
.sl-markdown-content :not(pre) > code {
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 28%, var(--sl-color-hairline));
  border-radius: 0.4rem;
  padding: 0.14rem 0.34rem;
}

.sl-markdown-content :is(pre, .expressive-code) {
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 24%, var(--sl-color-hairline));
  border-radius: 0.75rem;
  box-shadow: 0 12px 32px color-mix(in hsl, var(--sl-color-accent-low) 26%, transparent);
}

/* ── Tables ──────────────────────────────────────────────────── */
.sl-markdown-content table {
  display: table;
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-inline: auto;
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--sl-color-hairline);
}

.sl-markdown-content :is(th, td) { padding: 0.6rem 0.9rem; }
.sl-markdown-content :is(th:first-child, td:first-child) { width: 9.5rem; }
.sl-markdown-content :is(th:nth-child(2), td:nth-child(2)) { width: 15rem; }

.sl-markdown-content thead {
  background: color-mix(in hsl, var(--sl-color-accent-low) 24%, transparent);
}

.sl-markdown-content blockquote {
  border-inline-start: 3px solid var(--sl-color-accent);
  background: color-mix(in hsl, var(--sl-color-accent-low) 16%, transparent);
  border-radius: 0 0.65rem 0.65rem 0;
}

/* ── Buttons ─────────────────────────────────────────────────── */
.sl-link-button.primary {
  border-color: color-mix(in hsl, var(--sl-color-accent) 68%, var(--sl-color-black));
  background: linear-gradient(160deg, color-mix(in hsl, var(--sl-color-accent) 92%, white), var(--sl-color-accent));
  box-shadow: 0 10px 24px color-mix(in hsl, var(--sl-color-accent) 26%, transparent);
}

.sl-link-button.secondary {
  border-color: color-mix(in hsl, var(--sl-color-accent) 54%, var(--sl-color-hairline));
  background: color-mix(in hsl, var(--sl-color-accent-low) 22%, transparent);
}

/* ── Hero ────────────────────────────────────────────────────── */
html[data-has-hero] .hero {
  position: relative;
  overflow: clip;
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 34%, var(--sl-color-hairline));
  border-radius: 1rem;
  padding: clamp(1.3rem, 1rem + 1.2vw, 2.15rem);
  background:
    radial-gradient(900px 300px at 2% 0%, color-mix(in hsl, var(--sl-color-accent) 24%, transparent), transparent 60%),
    radial-gradient(620px 250px at 94% 4%, color-mix(in hsl, var(--sl-color-blue) 28%, transparent), transparent 64%),
    linear-gradient(180deg, color-mix(in hsl, var(--sl-color-accent-low) 28%, transparent), transparent 46%);
  box-shadow: 0 12px 34px color-mix(in hsl, var(--sl-color-accent-low) 40%, transparent);
}

html[data-has-hero] .hero::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  border: 1px solid color-mix(in hsl, var(--sl-color-accent-high) 35%, transparent);
  opacity: 0.6;
}

html[data-has-hero] .hero .copy { max-width: 46rem; }

html[data-has-hero] .hero .tagline {
  max-width: 60ch;
  color: color-mix(in hsl, var(--sl-color-text) 88%, var(--sl-color-accent-high));
}

html[data-has-hero] .hero .actions { margin-top: 0.26rem; }

html[data-has-hero] .sl-markdown-content .card-grid { margin-top: 0.82rem; }

html[data-has-hero] .sl-markdown-content .card,
html[data-has-hero] .sl-markdown-content .sl-link-card {
  background: color-mix(in hsl, var(--sl-color-black) 90%, var(--sl-color-accent-low));
  border-color: color-mix(in hsl, var(--sl-color-accent) 22%, var(--sl-color-hairline));
}

html[data-has-hero] .sl-markdown-content .sl-link-card {
  transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  border-radius: 0.74rem;
}

html[data-has-hero] .sl-markdown-content .sl-link-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in hsl, var(--sl-color-accent) 56%, var(--sl-color-hairline));
  box-shadow: 0 10px 24px color-mix(in hsl, var(--sl-color-accent-low) 34%, transparent);
}

/* ── Home status / command row ───────────────────────────────── */
html[data-has-hero] .sl-markdown-content .home-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
  margin: 0.35rem 0 1rem;
}

html[data-has-hero] .sl-markdown-content .home-status-card {
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 24%, var(--sl-color-hairline));
  border-radius: 0.68rem;
  padding: 0.56rem 0.72rem;
  background:
    linear-gradient(180deg, color-mix(in hsl, var(--sl-color-accent-low) 18%, transparent), transparent 55%),
    color-mix(in hsl, var(--sl-color-black) 94%, var(--sl-color-accent-low));
}

html[data-has-hero] .sl-markdown-content .home-status-card span {
  display: block;
  margin-bottom: 0.2rem;
  font-size: var(--sl-text-2xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in hsl, var(--sl-color-text) 72%, var(--sl-color-accent-high));
}

html[data-has-hero] .sl-markdown-content .home-status-card strong {
  font-size: var(--sl-text-sm);
  color: color-mix(in hsl, var(--sl-color-white) 90%, var(--sl-color-accent-high));
  font-weight: 600;
}

html[data-theme='light'][data-has-hero] .sl-markdown-content .home-status-card {
  background:
    linear-gradient(180deg, color-mix(in hsl, var(--sl-color-accent-low) 42%, transparent), transparent 58%),
    color-mix(in hsl, var(--sl-color-black) 96%, var(--sl-color-accent-low));
}

html[data-has-hero] .sl-markdown-content .home-command-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin: 0.1rem 0 0.75rem;
}

html[data-has-hero] .sl-markdown-content .home-command-row code {
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 34%, var(--sl-color-hairline));
  border-radius: 0.45rem;
  padding: 0.22rem 0.52rem;
  background: color-mix(in hsl, var(--sl-color-accent-low) 18%, transparent);
  font-size: var(--sl-text-xs);
}

html[data-has-hero] .sl-markdown-content .home-screenshot-wrap {
  margin: 1.25rem 0 1.4rem;
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 30%, var(--sl-color-hairline));
  border-radius: 0.9rem;
  padding: 0.55rem;
  background:
    linear-gradient(180deg, color-mix(in hsl, var(--sl-color-accent-low) 24%, transparent), transparent 28%),
    color-mix(in hsl, var(--sl-color-black) 92%, var(--sl-color-accent-low));
  box-shadow: 0 12px 30px color-mix(in hsl, var(--sl-color-accent-low) 36%, transparent);
}

html[data-has-hero] .sl-markdown-content .home-screenshot {
  width: 100%;
  border-radius: 0.58rem;
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 26%, var(--sl-color-hairline));
  display: block;
}

html[data-has-hero] .sl-markdown-content .home-screenshot-wrap figcaption {
  margin-top: 0.62rem;
  font-size: var(--sl-text-sm);
  color: color-mix(in hsl, var(--sl-color-text) 86%, var(--sl-color-accent-high));
}

/* ── Terminal preview component ──────────────────────────────── */
.terminal-preview {
  font-family: var(--sl-font-mono);
  font-size: 0.78rem;
  line-height: 1.45;
  background: hsl(0, 0%, 4%);
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 34%, var(--sl-color-hairline));
  border-radius: 0.75rem;
  overflow: hidden;
  margin: 1rem 0 1.4rem;
  box-shadow: 0 16px 40px color-mix(in hsl, var(--sl-color-accent-low) 32%, transparent);
  user-select: none;
}

.tp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.38rem 0.9rem;
  background: color-mix(in hsl, var(--sl-color-accent-low) 36%, hsl(0,0%,5%));
  border-bottom: 1px solid color-mix(in hsl, var(--sl-color-accent) 22%, var(--sl-color-hairline));
}

.tp-title { color: var(--sl-color-accent); font-weight: 600; letter-spacing: 0.04em; }
.tp-time { color: var(--sl-color-gray-3); font-size: 0.72rem; }

.tp-body {
  display: grid;
  grid-template-columns: 52% 48%;
  min-height: 180px;
}

.tp-list {
  border-right: 1px solid color-mix(in hsl, var(--sl-color-accent) 18%, var(--sl-color-hairline));
  padding: 0.55rem 0;
}

.tp-detail { padding: 0.55rem 0.8rem; }

.tp-section-title {
  padding: 0 0.8rem 0.35rem;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--sl-color-gray-3);
}

.tp-row {
  display: flex;
  justify-content: space-between;
  padding: 0.22rem 0.8rem;
  gap: 0.5rem;
  cursor: default;
  transition: background 80ms;
}

.tp-row--selected {
  background: color-mix(in hsl, var(--sl-color-accent) 16%, transparent);
}

.tp-row-name {
  color: var(--sl-color-gray-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.tp-row--selected .tp-row-name { color: var(--sl-color-accent-high); }
.tp-row-yes { font-weight: 600; flex-shrink: 0; }

.tp-detail-name {
  color: var(--sl-color-accent-high);
  font-weight: 600;
  font-size: 0.82rem;
  margin-bottom: 0.55rem;
  line-height: 1.35;
}

.tp-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem 0.5rem;
  margin-bottom: 0.6rem;
}

.tp-kv {
  display: flex;
  justify-content: space-between;
  padding: 0.22rem 0.36rem;
  background: color-mix(in hsl, var(--sl-color-accent-low) 12%, transparent);
  border-radius: 0.32rem;
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 14%, var(--sl-color-hairline));
}

.tp-kv span { color: var(--sl-color-gray-3); font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; }
.tp-kv strong { font-weight: 600; font-size: 0.78rem; }

.tp-green { color: hsl(155, 90%, 55%); }
.tp-red   { color: hsl(355, 85%, 62%); }

.tp-chart {
  font-size: 0.92rem;
  color: color-mix(in hsl, var(--sl-color-accent) 72%, transparent);
  letter-spacing: 0.04em;
  margin-bottom: 0.5rem;
  line-height: 1;
}

.tp-chart-tip { color: var(--sl-color-accent); }

.tp-actions { color: var(--sl-color-gray-3); font-size: 0.7rem; }

.tp-key {
  display: inline-block;
  padding: 0.06rem 0.3rem;
  border: 1px solid color-mix(in hsl, var(--sl-color-accent) 30%, var(--sl-color-hairline));
  border-radius: 0.28rem;
  background: color-mix(in hsl, var(--sl-color-accent-low) 20%, transparent);
  color: var(--sl-color-accent-high);
  font-weight: 600;
  margin-right: 0.15rem;
}

.tp-status {
  display: flex;
  justify-content: space-between;
  padding: 0.3rem 0.9rem;
  background: color-mix(in hsl, var(--sl-color-accent-low) 20%, hsl(0,0%,4%));
  border-top: 1px solid color-mix(in hsl, var(--sl-color-accent) 18%, var(--sl-color-hairline));
  font-size: 0.7rem;
  color: var(--sl-color-gray-3);
  gap: 1rem;
}

.tp-cursor { display: inline-block; width: 0.5ch; }

/* ── Focus ring ──────────────────────────────────────────────── */
:where(a, button, summary, input, select, textarea):focus-visible {
  outline: 2px solid color-mix(in hsl, var(--sl-color-accent) 88%, white);
  outline-offset: 2px;
  border-radius: 0.4rem;
}

/* ── Animations ──────────────────────────────────────────────── */
@media (prefers-reduced-motion: no-preference) {
  html[data-has-hero] .hero { animation: sl-hero-enter 320ms ease-out; }
  html[data-has-hero] .sl-markdown-content .card-grid > * { animation: sl-rise 240ms ease-out; }
}

@keyframes sl-hero-enter {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes sl-rise {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Responsive ──────────────────────────────────────────────── */
@media (max-width: 50rem) {
  html[data-has-hero] .hero { border-radius: 0.75rem; padding: 1rem; }

  .sl-markdown-content .guide-kpi-grid,
  html[data-has-hero] .sl-markdown-content .home-status-grid {
    grid-template-columns: 1fr;
    gap: 0.45rem;
  }

  .sl-markdown-content table {
    display: block;
    width: 100%;
    overflow-x: auto;
    table-layout: auto;
    font-size: var(--sl-text-xs);
  }

  .sl-markdown-content :is(th:first-child, td:first-child),
  .sl-markdown-content :is(th:nth-child(2), td:nth-child(2)) { width: auto; }

  .tp-body { grid-template-columns: 1fr; }
  .tp-detail { display: none; }
}
          `,
        },
      ],
      sidebar: [
        { label: "Home", link: "/" },
        { label: "Introduction", link: "/introduction/" },
        {
          label: "Getting Started",
          items: ["getting-started", "installation"],
        },
        {
          label: "User Guide",
          items: [
            "user-guide",
            "user-guide/workspace-navigation",
            "user-guide/trading-and-orders",
            "user-guide/portfolio-alerts-and-watchlist",
            "user-guide/chat-automation-and-messages",
            "user-guide/settings-wallet-auth",
          ],
        },
        {
          label: "CLI Reference",
          items: ["cli/overview"],
        },
        {
          label: "MCP Server",
          items: ["mcp/overview", "mcp/tools"],
        },
        {
          label: "Telegram Bot",
          items: ["telegram/setup"],
        },
        {
          label: "Architecture",
          items: ["architecture/overview", "architecture/state-and-keyboard"],
        },
        {
          label: "Core Modules",
          items: ["api/overview", "components/layout-and-panels", "hooks/overview"],
        },
        {
          label: "Reference",
          items: ["reference/keybindings", "reference/persistence", "reference/types-and-utils"],
        },
        {
          label: "Deployment",
          items: ["deployment/cloudflare"],
        },
        { label: "Changelog", link: "/changelog/" },
      ],
    }),
  ],
});
