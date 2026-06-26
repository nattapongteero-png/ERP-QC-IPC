/**
 * LLM Client - vllm-gemma (Gemma-4-31B, OpenAI-compatible)
 *
 * The "Brain". Used for chat, RAG Q&A over SOP/GMP docs, summarization (CAPA,
 * batch records, deviations), and structured extraction.
 *
 * Degrades gracefully: returns null when unconfigured / on error, mirroring the
 * existing issues-ai.service.ts pattern so callers never crash on AI downtime.
 */

import { AI_CONFIG, buildHeaders, isConfigured } from './config';
import type { ChatMessage, ChatOptions, ChatResult } from './types';

/**
 * Send a chat request to the LLM brain.
 *
 * @returns ChatResult on success, or null if unconfigured / timed out / errored.
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResult | null> {
  if (!isConfigured('llm')) {
    console.warn('[ai/llm] AI_LLM_BASE_URL not configured');
    return null;
  }

  const { baseUrl, apiKey, model: defaultModel, timeout } = AI_CONFIG.llm;
  const model = options.model || defaultModel;

  const body: Record<string, unknown> = {
    model,
    messages,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
  if (options.jsonMode) body.response_format = { type: 'json_object' };

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs || timeout),
    });

    if (!response.ok) {
      console.error(`[ai/llm] HTTP ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      console.error('[ai/llm] Invalid response structure (no message content)');
      return null;
    }

    return {
      content,
      model: data?.model || model,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  } catch (error) {
    logAiError('llm', error);
    return null;
  }
}

/**
 * Convenience: single-turn prompt with an optional system instruction.
 */
export async function complete(
  prompt: string,
  systemPrompt?: string,
  options: ChatOptions = {}
): Promise<string | null> {
  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const result = await chat(messages, options);
  return result?.content ?? null;
}

/**
 * Convenience: prompt that returns parsed JSON. Forces json mode and parses the
 * response. Returns null on any failure (network, parse, etc.).
 */
export async function completeJson<T = unknown>(
  prompt: string,
  systemPrompt?: string,
  options: ChatOptions = {}
): Promise<T | null> {
  const content = await complete(prompt, systemPrompt, { ...options, jsonMode: true });
  if (content === null) return null;
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('[ai/llm] Failed to parse JSON response:', error);
    return null;
  }
}

/** Shared structured error logging for AI clients. */
export function logAiError(service: string, error: unknown): void {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.warn(`[ai/${service}] request timed out`);
    } else {
      console.error(`[ai/${service}] request failed:`, error.message);
    }
  } else {
    console.error(`[ai/${service}] unknown error:`, error);
  }
}
