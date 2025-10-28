import { useState, useEffect } from "react";
import type { Tiktoken } from "js-tiktoken";

let encoder: Tiktoken | null = null;
let encoderPromise: Promise<Tiktoken> | null = null;

/**
 * Get or initialize the tiktoken encoder (lazy-loaded)
 */
async function getEncoder(): Promise<Tiktoken> {
  if (encoder) {
    return encoder;
  }

  // If already loading, wait for it
  if (encoderPromise) {
    return encoderPromise;
  }

  // Lazy load the encoding (code-splitting optimization)
  encoderPromise = import("js-tiktoken").then((module) => {
    // Use cl100k_base encoding (used by GPT-4, GPT-3.5-turbo)
    encoder = module.getEncoding("cl100k_base");
    encoderPromise = null; // Clear promise after loading
    return encoder;
  });

  return encoderPromise;
}

/**
 * Count tokens in a text string (async)
 */
export async function countTokens(text: string): Promise<number> {
  if (!text) return 0;
  try {
    const enc = await getEncoder();
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    console.error("Error counting tokens:", error);
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Hook to count tokens in real-time
 */
export function useTokenCount(text: string): {
  count: number;
  isLoading: boolean;
} {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    
    // Debounce to avoid too many calculations
    const timeoutId = setTimeout(async () => {
      const tokenCount = await countTokens(text);
      setCount(tokenCount);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [text]);

  return { count, isLoading };
}
