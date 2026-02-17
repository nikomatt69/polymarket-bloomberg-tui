import { render } from "@opentui/solid";
import { App } from "./app";

await render(() => <App />, { useMouse: true });
