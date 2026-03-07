/**
 * Thin assistant transport adapter.
 * The canonical runtime lives in src/agent/reasoning.ts and src/agent/tools/*.
 */

import { chatMessages, type ToolCall, currentSessionId } from "../state";
import { getToolsForMode } from "../agent/tools";
import { assistantMode } from "../state";
import { runAssistantStream } from "../agent/reasoning";

export async function sendMessageToAssistantStream(
  onChunk?: (chunk: string) => void,
  onToolCall?: (tool: {
    id: string;
    name: string;
    args: unknown;
    category?: string;
    riskLevel?: "low" | "medium" | "high" | "critical";
    requiresConfirmation?: boolean;
    startedAt: number;
  }) => void,
  onToolResult?: (tool: {
    id: string;
    name: string;
    result: unknown;
    completedAt: number;
  }) => void,
  onToolError?: (tool: {
    id: string;
    name: string;
    error: string;
    completedAt: number;
  }) => void,
): Promise<{ response: string; toolCalls: ToolCall[]; tokensUsed: number }> {
  const result = await runAssistantStream(chatMessages(), currentSessionId(), {
    onChunk,
    onToolCall,
    onToolResult,
    onToolError,
  });

  return {
    response: result.response,
    toolCalls: result.toolCalls,
    tokensUsed: result.tokensUsed,
  };
}

export function getToolDefinitions() {
  return getToolsForMode(assistantMode());
}
