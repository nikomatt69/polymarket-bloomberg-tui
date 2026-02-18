/**
 * Reasoning Loop - Think → Act → Observe → Refine → Answer
 */

import { streamText, tool as createAiTool, zodSchema } from "ai";
import { z } from "zod";
import { getActiveAIProvider } from "../state";
import { AgentSession, createToolCall, completeToolCall, type ToolCall } from "./session";
import { getTUIContext, formatTUIContextForPrompt } from "./context";
import type { AgentContext, TUIContext } from "./tool";

/**
 * Reasoning step types
 */
export type ReasoningStep = "thinking" | "acting" | "observing" | "refining" | "answering";

/**
 * Reasoning state for tracking progress
 */
export interface ReasoningState {
  currentStep: ReasoningStep;
  thought: string;
  toolCalls: ToolCall[];
  observations: string[];
  isComplete: boolean;
}

/**
 * Chunk callback for streaming
 */
export type ReasoningChunkCallback = (chunk: {
  type: "reasoning" | "content" | "tool_call" | "tool_result" | "step";
  text?: string;
  toolCall?: ToolCall;
  toolResult?: unknown;
  step?: ReasoningStep;
}) => void;

/**
 * Default system prompt with reasoning instructions
 */
export function buildSystemPrompt(tuiContext: TUIContext, extraInstructions?: string): string {
  const ctx = formatTUIContextForPrompt(tuiContext);

  return `You are a **Polymarket Trading Agent** - an AI-powered trading assistant for Polymarket prediction markets.

## Your Role
You are NOT just a chatbot. You are a trading agent that can ANALYZE markets, CALCULATE positions, and EXECUTE real trades on behalf of the user.

## Reasoning Loop (IMPORTANT)
You work in a LOOP of thinking → tool calling → observing results → thinking more → more tools → final answer:

1. **THINK**: Analyze the user's request and plan your approach
2. **ACT**: Call appropriate tools to gather data
3. **OBSERVE**: Look at the tool results carefully
4. **REFINE**: If needed, call more tools to get additional info
5. **ANSWER**: Provide a complete, actionable response

Show your reasoning! Use phrases like:
- "Let me think about this..."
- "First, I need to check..."
- "Looking at the results..."
- "Now I should..."
- "Based on that..."

## Current TUI State
${ctx}

## Trading Capabilities
You have access to powerful trading tools:
- **place_order**: Execute real trades (BUY/SELL) with real money
- **get_order_book**: Analyze liquidity, bid/ask spread
- **get_market_price**: Get current prices
- **get_open_orders**: Monitor pending orders
- **get_trade_history**: Review past trades
- **cancel_order**: Manage/cancel open orders
- **get_positions_details**: View positions with PnL calculations

## Market Discovery Capabilities
- **search_markets**: Find markets by keyword
- **get_categories**: List all categories
- **search_by_category**: Filter by category
- **get_trending_markets**: Most popular markets
- **get_sports_markets**: Live sports markets
- **get_live_events**: Currently live events
- **get_series_markets**: Markets for specific series
- **get_all_series**: Available series

## Trading Best Practices
1. **Before placing any trade**:
   - Always check the order book for liquidity
   - Analyze the spread - tight spreads = better execution
   - Never trade illiquid markets

2. **Position Sizing**:
   - NEVER risk more than 5-10% of total balance
   - Calculate: max_shares = (balance * 0.05) / price

3. **Risk Management**:
   - Prediction markets are binary options
   - Check volume (> $100k = good liquidity)
   - Look for tight bid/ask spreads (<0.02)

## Guidelines
- Be proactive - suggest trades when you see opportunities
- Always warn about risks
- Show your reasoning explicitly
- If balance is low, inform the user

## Tool Display
IMPORTANT: When you call tools, show them in your response as:
-> tool_name: {"param": "value"} = result

This helps the user understand what you're doing.

${extraInstructions ?? ""}

Respond in the same language as the user. Be concise but thorough on trading matters.`;
}

/**
 * Execute a tool and track it
 */
export async function executeToolWithTracking(
  toolName: string,
  args: Record<string, unknown>,
  executeFn: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  onChunk?: ReasoningChunkCallback
): Promise<{ toolCall: ToolCall; result: unknown; success: boolean; error?: string }> {
  const toolCall = createToolCall(toolName, args);

  // Notify tool call start
  onChunk?.({
    type: "tool_call",
    toolCall,
  });

  try {
    const result = await executeFn(toolName, args);
    const completed = completeToolCall(toolCall, result, true);

    // Notify tool result
    onChunk?.({
      type: "tool_result",
      toolCall: completed,
      toolResult: result,
    });

    return { toolCall: completed, result, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const completed = completeToolCall(toolCall, null, false, errorMessage);

    // Notify tool error
    onChunk?.({
      type: "tool_result",
      toolCall: completed,
      toolResult: errorMessage,
    });

    return { toolCall: completed, result: null, success: false, error: errorMessage };
  }
}

/**
 * Run the reasoning loop with AI
 */
export async function runReasoningLoop(
  userInput: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tools: Record<string, {
    description: string;
    parameters: z.ZodType;
    execute: (args: Record<string, unknown>) => Promise<unknown>;
  }>,
  onChunk?: ReasoningChunkCallback
): Promise<{ response: string; toolCalls: ToolCall[] }> {
  const provider = getActiveAIProvider();

  if (!provider) {
    return {
      response: "No AI provider configured. Open Settings > PROVIDERS to configure one.",
      toolCalls: [],
    };
  }

  const apiKey = (provider.apiKey ?? "").trim();
  if (!apiKey) {
    return {
      response: `Provider "${provider.name}" has no API key. Open Settings > PROVIDERS and add the key.`,
      toolCalls: [],
    };
  }

  // Get TUI context
  const tuiContext = getTUIContext();

  // Build system prompt
  const systemPrompt = buildSystemPrompt(tuiContext);

  // Add user message to session
  AgentSession.addUserMessage(userInput);

  // Save TUI context
  AgentSession.saveTUIContext(tuiContext);

  // Get conversation history
  const messages = AgentSession.getMessagesForAI();

  let fullText = "";
  const allToolCalls: ToolCall[] = [];

  try {
    // Notify thinking start
    onChunk?.({ type: "step", step: "thinking" });

    // Resolve model
    const { model, providerName } = resolveModel(provider);

    // Use the tools from the assistant module directly
    // Note: This is a simplified version - in production you'd use the tools parameter
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      maxSteps: 15,
      temperature: 0.7,
      onError: (error) => {
        console.error("Stream error:", error);
      },
    });

    // Process stream
    for await (const chunk of result.textStream) {
      fullText += chunk;
      onChunk?.({ type: "content", text: chunk });
    }

    // Add assistant message to session
    AgentSession.addAssistantMessage(fullText, {
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    });

    return { response: fullText, toolCalls: allToolCalls };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      response: `Error: ${errorMessage}`,
      toolCalls: allToolCalls,
    };
  }
}

/**
 * Resolve AI model based on provider
 */
function resolveModel(provider: ReturnType<typeof getActiveAIProvider>): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  providerName: string;
} {
  if (!provider) {
    throw new Error("No provider configured");
  }

  if (provider.kind === "anthropic") {
    const { createAnthropic } = require("@ai-sdk/anthropic");
    const anthropic = createAnthropic({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
    });
    return {
      model: anthropic(provider.model),
      providerName: provider.name,
    };
  }

  const { createOpenAI } = require("@ai-sdk/openai");
  const openai = createOpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
    headers:
      provider.kind === "openrouter"
        ? {
            "HTTP-Referer": "https://polymarket-tui.local",
            "X-Title": "Polymarket Bloomberg TUI",
          }
        : undefined,
  });

  return {
    model: openai(provider.model),
    providerName: provider.name,
  };
}

/**
 * Create reasoning state
 */
export function createReasoningState(): ReasoningState {
  return {
    currentStep: "thinking",
    thought: "",
    toolCalls: [],
    observations: [],
    isComplete: false,
  };
}

/**
 * Update reasoning state
 */
export function updateReasoningState(
  state: ReasoningState,
  update: Partial<ReasoningState>
): ReasoningState {
  return { ...state, ...update };
}
