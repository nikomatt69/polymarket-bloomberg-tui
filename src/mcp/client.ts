import { MCPServer, type JSONRPCRequest, type JSONRPCResponse } from "./server";

export class MCPClient {
  private requestId = 0;

  constructor(private serverUrl?: string) {}

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method,
      params,
    };

    if (this.serverUrl) {
      const response = await fetch(this.serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const jsonRPCResponse: JSONRPCResponse = await response.json();
      if (jsonRPCResponse.error) {
        throw new Error(jsonRPCResponse.error.message);
      }
      return jsonRPCResponse.result;
    }

    const server = new MCPServer();
    const response = await server.handleRequest(request);
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.result;
  }

  async listTools(): Promise<unknown[]> {
    const result = (await this.request("tools/list")) as { tools: unknown[] };
    return result.tools;
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<unknown> {
    const result = (await this.request("tools/call", { name, arguments: args })) as {
      content: { text: string }[];
    };
    return JSON.parse(result.content[0].text);
  }

  async listResources(): Promise<unknown[]> {
    const result = (await this.request("resources/list")) as { resources: unknown[] };
    return result.resources;
  }

  async readResource(uri: string): Promise<string> {
    const result = (await this.request("resources/read", { uri })) as {
      contents: { text: string }[];
    };
    return result.contents[0].text;
  }
}

export async function connectToServer(url: string): Promise<MCPClient> {
  const client = new MCPClient(url);
  await client.request("initialize");
  return client;
}
