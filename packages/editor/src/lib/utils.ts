import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn's class merger. Vendored AI Elements import this as `@/lib/utils`;
    the vendoring step rewrites that to a relative path. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
