import "server-only";
import { env } from "@/lib/env";
import { AnthropicAIProvider } from "./providers/anthropic";
import { RuleBasedAIProvider } from "./providers/rule-based";
import type { AIProvider } from "./types";

let provider: AIProvider | undefined;

/** Returns the configured AI provider: Claude when AI_API_KEY is set, otherwise the built-in rule-based provider. */
export function getAIProvider(): AIProvider {
  if (!provider) {
    const e = env();
    provider = e.AI_API_KEY ? new AnthropicAIProvider(e.AI_API_KEY, e.AI_MODEL) : new RuleBasedAIProvider();
  }
  return provider;
}
