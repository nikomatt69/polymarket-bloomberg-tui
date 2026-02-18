/**
 * Bash Tool - Execute shell commands and search processes
 */

import { z } from "zod";
import { spawn } from "bun";
import type { ToolDefinition, ToolResult } from "../tool";
import type { AgentContext } from "../tool";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ExecuteBashSchema = z.object({
  command: z.string().describe("Shell command to execute"),
  timeout: z.number().optional().default(30000).describe("Timeout in milliseconds"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPTS = {
  execute_bash: {
    description: "Execute a shell command to run searches or data processing",
    instructions: `Use this when:
- User wants to run a command-line search
- Need to process data externally
- Run custom scripts

IMPORTANT: This runs in a sandboxed environment. Keep commands simple and focused on data retrieval.`,
    example: `execute_bash({ command: "curl -s https://api.example.com/search?q=test" })`,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────────────────────

export async function executeBashTool(args: z.infer<typeof ExecuteBashSchema>, ctx: AgentContext): Promise<ToolResult> {
  const { command, timeout } = args;

  // Security check - only allow certain commands
  const allowedCommands = [
    "curl",
    "wget",
    "grep",
    "cat",
    "echo",
    "date",
    "jq",
    "python3",
    "python",
    "node",
  ];

  const commandParts = command.trim().split(/\s+/);
  const baseCommand = commandParts[0];

  if (!allowedCommands.includes(baseCommand)) {
    return {
      success: false,
      error: `Command "${baseCommand}" not allowed. Allowed: ${allowedCommands.join(", ")}`,
    };
  }

  try {
    const process = spawn({
      cmd: commandParts,
      timeout: timeout ?? 30000,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);

    const exitCode = await process.exited;

    return {
      success: exitCode === 0,
      data: {
        command,
        exitCode,
        stdout: stdout.slice(0, 10000), // Limit output size
        stderr: stderr.slice(0, 5000),
      },
      metadata: {
        exitCode,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Command execution failed",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────────────────────

export const tools: ToolDefinition<z.ZodType>[] = [
  {
    id: "bash.execute_bash",
    name: "execute_bash",
    category: "analysis",
    description: PROMPTS.execute_bash.description,
    parameters: ExecuteBashSchema as z.ZodType,
    examples: [PROMPTS.execute_bash.example],
    requiresWallet: false,
    executesTrade: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Executor Map
// ─────────────────────────────────────────────────────────────────────────────

export const executors: Record<string, (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolResult>> = {
  execute_bash: async (args, ctx) => executeBashTool(args as z.infer<typeof ExecuteBashSchema>, ctx),
};
