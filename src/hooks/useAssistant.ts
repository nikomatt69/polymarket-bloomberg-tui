/**
 * Assistant hook for managing AI chat state and interactions
 */

import { createSignal } from "solid-js";
import {
  chatMessages,
  setChatMessages,
  chatLoading,
  setChatLoading,
  chatInputValue,
  setChatInputValue,
  chatInputFocused,
  setChatInputFocused,
  ChatMessage,
} from "../state";
import { sendMessageToAssistantStream } from "../api/assistant";

const MAX_CHAT_MESSAGES = 100;

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function addMessageWithLimit(msg: ChatMessage) {
  setChatMessages((msgs) => {
    const updated = [...msgs, msg];
    // Keep only the last MAX_CHAT_MESSAGES
    if (updated.length > MAX_CHAT_MESSAGES) {
      return updated.slice(-MAX_CHAT_MESSAGES);
    }
    return updated;
  });
}

export function useAssistant() {
  const submitPrompt = async () => {
    const input = chatInputValue().trim();
    if (!input || chatLoading()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    addMessageWithLimit(userMessage);
    setChatInputValue("");
    setChatLoading(true);

    try {
      const { response, toolCalls } = await sendMessageToAssistantStream((chunk) => {
        // Could stream chunks to UI in real-time if needed
      });

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
        toolCalls,
      };

      addMessageWithLimit(assistantMessage);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      // Add error message
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      };
      addMessageWithLimit(errorMessage);
    } finally {
      setChatLoading(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
  };

  const setInput = (value: string) => {
    setChatInputValue(value);
  };

  const focusInput = () => {
    setChatInputFocused(true);
  };

  const blurInput = () => {
    setChatInputFocused(false);
    setChatInputValue("");
  };

  return {
    messages: chatMessages,
    loading: chatLoading,
    input: chatInputValue,
    setInput,
    focused: chatInputFocused,
    focusInput,
    blurInput,
    submitPrompt,
    clearChat,
  };
}
