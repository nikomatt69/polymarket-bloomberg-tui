import { createEffect, onCleanup } from "solid-js";
import { stdin } from "process";

export interface KeyHandler {
  key: string;
  handler: () => void;
  description?: string;
}

let isSetup = false;

export function useKeyboardInput(handlers: KeyHandler[]): void {
  if (isSetup) return;
  isSetup = true;

  createEffect(() => {
    const handleData = (chunk: Buffer | string) => {
      const key = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      handleKey(key, handlers);
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    stdin.on("data", handleData);

    onCleanup(() => {
      stdin.removeListener("data", handleData);
      stdin.setRawMode?.(false);
      stdin.pause();
    });
  });
}

function handleKey(key: string, handlers: KeyHandler[]): void {
  if (key === "\u0003" || key === "q") {
    cleanup();
    process.exit(0);
  }

  const keyMap: Record<string, string> = {
    "\x1b[A": "ArrowUp",
    "\x1b[B": "ArrowDown",
    "\x1b[C": "ArrowRight",
    "\x1b[D": "ArrowLeft",
    "\r": "Enter",
    "\n": "Enter",
  };

  if (key === "\u000b") {
    const handler = handlers.find((h) => h.key === "CtrlK");
    if (handler) handler.handler();
    return;
  }

  const parsedKey = keyMap[key] || key.toLowerCase();
  const handler = handlers.find((h) => h.key === parsedKey);
  if (handler) {
    handler.handler();
  }
}

function cleanup(): void {
  stdin.setRawMode?.(false);
}
