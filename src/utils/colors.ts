/**
 * ANSI color and styling utilities for terminal output
 */

export const COLORS = {
  // Basic colors
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  inverse: "\x1b[7m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright foreground colors
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
};

export function colorize(text: string, color: string): string {
  return `${color}${text}${COLORS.reset}`;
}

export function bold(text: string): string {
  return `${COLORS.bright}${text}${COLORS.reset}`;
}

export function dim(text: string): string {
  return `${COLORS.dim}${text}${COLORS.reset}`;
}

export function green(text: string): string {
  return colorize(text, COLORS.green);
}

export function red(text: string): string {
  return colorize(text, COLORS.red);
}

export function yellow(text: string): string {
  return colorize(text, COLORS.yellow);
}

export function cyan(text: string): string {
  return colorize(text, COLORS.cyan);
}

export function blue(text: string): string {
  return colorize(text, COLORS.blue);
}

export function formatChangeColor(change: number, changeText: string): string {
  if (change > 0) {
    return green(changeText);
  } else if (change < 0) {
    return red(changeText);
  }
  return yellow(changeText);
}

export function underline(text: string): string {
  return `${COLORS.underline}${text}${COLORS.reset}`;
}

export function inverse(text: string): string {
  return `${COLORS.inverse}${text}${COLORS.reset}`;
}
