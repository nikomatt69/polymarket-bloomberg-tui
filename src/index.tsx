import { render, extend } from "@opentui/solid";
import { App } from "./app";
import pkg from "../package.json";
import { ThreeRenderable } from "@opentui/core/3d";

extend({ three: ThreeRenderable });

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    three: typeof ThreeRenderable;
  }
}

declare const POLYTUI_DASHBOARD_VERSION: string | undefined;

const version =
  typeof POLYTUI_DASHBOARD_VERSION !== "undefined"
    ? POLYTUI_DASHBOARD_VERSION
    : pkg.version;

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(version);
  process.exit(0);
}

await render(() => <App />, { useMouse: true });
