import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .map(word => 
      word.length > 0 
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : ''
    )
    .join(' ');
}
