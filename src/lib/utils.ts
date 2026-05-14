import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Masks an email address for safe server-side logging: anna@example.com → an**@example.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = Math.min(2, local.length);
  return local.slice(0, visible) + "**" + domain;
}
