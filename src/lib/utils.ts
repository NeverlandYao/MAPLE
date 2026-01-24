import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Preprocesses LaTeX content by converting \[ ... \] to $$ ... $$ 
 * and \( ... \) to $ ... $ for compatibility with remark-math.
 */
export function preprocessLaTeX(content: string) {
  if (!content) return content;
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `$$\n${math}\n$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math}$`);
}
