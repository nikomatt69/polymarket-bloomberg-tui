import { render } from "@opentui/solid";
import { App } from "./app";
import pkg from "../package.json";

declare const POLYMARKET_BLOOMBERG_TUI_VERSION: string | undefined;

const version =
  typeof POLYMARKET_BLOOMBERG_TUI_VERSION !== "undefined"
    ? POLYMARKET_BLOOMBERG_TUI_VERSION
    : pkg.version;

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(version);
  process.exit(0);
}

await render(() => <App />, { useMouse: true });
