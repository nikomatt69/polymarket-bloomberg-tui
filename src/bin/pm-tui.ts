#!/usr/bin/env bun

/**
 * PM-TUI CLI - Incur-based CLI for exposing agent tools
 *
 * Usage:
 *   bun run src/bin/pm-tui.ts --help
 *   bun run src/bin/pm-tui.ts --llms    # Output manifest for agents
 *   bun run src/bin/pm-tui.ts --mcp    # MCP stdio mode
 *   bun run src/bin/pm-tui.ts search_markets --query "election"
 */

import { Cli, z } from "incur";
import { getToolsForMode, executeTool, type ToolDefinition } from "../agent/tools";
import { createAgentContext } from "../agent/context";

const CLI_NAME = "pm-tui";

/**
 * Create CLI with all tools as commands
 *
 * Note: Using z from incur to ensure compatibility with their Zod v4
 */
function createCLI() {
  const cli = Cli.create(CLI_NAME, {
    description: "Polymarket TUI CLI - Expose agent tools via incur",
    version: "1.0.0",
  });

  // Get tools for 'trader' mode (most complete set)
  const tools = getToolsForMode("trader");

  for (const tool of tools) {
    // Build Zod schema using incur's Zod for compatibility
    const shape: Record<string, any> = {};
    const toolSchema = (tool.parameters as any).shape;

    for (const [key, value] of Object.entries(toolSchema)) {
      const zodDef = (value as any)._def;
      const desc = (value as any).description || key;

      // Handle ZodDefault (has default value)
      let baseValue = value;
      let hasDefault = false;
      let defaultValue: any = undefined;
      if (zodDef.typeName === "ZodDefault") {
        hasDefault = true;
        defaultValue = zodDef.defaultValue();
        baseValue = zodDef.innerType;
        const baseDef = (baseValue as any)._def;
        // Check if inner type is optional
        if (baseDef.typeName === "ZodOptional") {
          baseValue = baseDef.innerType;
        }
      }

      const baseDef = (baseValue as any)._def;

      // Check if optional (outside of default)
      const isOptional = hasDefault || zodDef.typeName === "ZodOptional" ||
        (baseDef.typeName === "ZodOptional");

      if (isOptional) {
        const innerDef = baseDef.innerType?._def || baseDef;
        if (innerDef?.typeName === "ZodEnum") {
          shape[key] = z.enum(innerDef.values).optional().describe(desc);
        } else if (innerDef?.typeName === "ZodNumber") {
          shape[key] = hasDefault
            ? z.number().default(defaultValue).describe(desc)
            : z.number().optional().describe(desc);
        } else if (innerDef?.typeName === "ZodBoolean") {
          shape[key] = hasDefault
            ? z.boolean().default(defaultValue).describe(desc)
            : z.boolean().optional().describe(desc);
        } else {
          shape[key] = hasDefault
            ? z.string().default(defaultValue).describe(desc)
            : z.string().optional().describe(desc);
        }
      } else if (baseDef.typeName === "ZodEnum") {
        shape[key] = z.enum(baseDef.values).describe(desc);
      } else if (baseDef.typeName === "ZodNumber") {
        shape[key] = z.number().describe(desc);
      } else if (baseDef.typeName === "ZodBoolean") {
        shape[key] = z.boolean().describe(desc);
      } else {
        shape[key] = z.string().describe(desc);
      }
    }

    const argsSchema = z.object(shape);

    cli.command(tool.name, {
      description: tool.description,
      args: argsSchema,
      run: async (ctx: any) => {
        const params = ctx.args || ctx;
        const cliCtx = createAgentContext("cli", `cmd-${tool.name}`);
        const result = await executeTool(tool.name, params, cliCtx);

        // Format output
        if (result.success) {
          return {
            ok: true,
            data: result.data,
            message: result.message,
          };
        } else {
          return {
            ok: false,
            error: result.error,
          };
        }
      },
    });
  }

  return cli;
}

// Create and serve the CLI
const cli = createCLI();
cli.serve();
