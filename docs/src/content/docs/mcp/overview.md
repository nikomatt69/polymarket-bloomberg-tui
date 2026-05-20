---
title: MCP Server Overview
description: Run polytui-dashboard as a Model Context Protocol server for AI agent and tooling integration.
---

polytui-dashboard ships a built-in **Model Context Protocol (MCP)** server that exposes the full market-data and trading surface to any MCP-compatible AI client — Claude Desktop, custom agents, or other tooling.

## Starting The Server

```bash
# stdio transport (default — for Claude Desktop, mcp-cli, etc.)
bun run mcp

# HTTP transport on port 3000
bun run mcp:http

# HTTP on a custom port
bun run src/mcp/server.ts --port 8080
```

## Transports

| Transport | Command | Use Case |
| --- | --- | --- |
| `stdio` | `bun run mcp` | Claude Desktop, local agents |
| `HTTP` | `bun run mcp:http` | Remote agents, microservices |

## Connecting From Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "polytui-dashboard": {
      "command": "bun",
      "args": ["run", "/path/to/polytui-dashboard/src/mcp/server.ts"]
    }
  }
}
```

Restart Claude Desktop. The polytui-dashboard tools will appear in the tool list.

## Connecting Via HTTP

Point any HTTP MCP client to:

```
http://localhost:3000
```

The server responds to standard MCP JSON-RPC requests over SSE.

## Authentication

The MCP server currently operates without authentication when run locally. If you expose it over a network, restrict access at the network/firewall level or add an `Authorization` header check to `src/mcp/server.ts`.

## Available Tools

See [MCP Tools Reference](/mcp/tools/) for the complete list of tools exposed by the server.

## State Dependency

The MCP server reads from and writes to the same shared state as the TUI. Running both simultaneously on the same machine is supported — state mutations from one surface propagate to the other.

## Extension Pattern

To add a new MCP tool:

1. Add the tool definition in `src/mcp/server.ts` (name, description, inputSchema).
2. Implement the handler calling existing API/state functions.
3. Return a `CallToolResult` with `content: [{ type: "text", text: ... }]`.
4. Document it in [MCP Tools Reference](/mcp/tools/).
