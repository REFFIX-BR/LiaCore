import { useState, useEffect } from "react";
import { Tiktoken, getEncoding } from "js-tiktoken";

let encoder: Tiktoken | null = null;

/**
 * Get or initialize the tiktoken encoder
 */
function getEncoder(): Tiktoken {
  if (!encoder) {
    // Use cl100k_base encoding (used by GPT-4, GPT-3.5-turbo)
    encoder = getEncoding("cl100k_base");
  }
  return encoder;
}

/**
 * Count tokens in a text string
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    const enc = getEncoder();
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
    const timeoutId = setTimeout(() => {
      const tokenCount = countTokens(text);
      setCount(tokenCount);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [text]);

  return { count, isLoading };
}
