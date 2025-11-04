import { cn } from "@public/lib/utils";

export function EclipticLogo({ className }: { className?: string }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" strokeWidth="2" stroke="currentColor" className={cn("w-auto", className)}>
    <g>
      <circle cx="12" cy="12" fill="none" r="10.8"></circle>
      <path d="m1.3,9.6c6,-2.4 15.6,-2.4 20.4,7.2" fill="none"></path>
    </g>
  </svg>
}