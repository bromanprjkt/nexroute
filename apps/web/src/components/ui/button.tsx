import * as React from "react"
import { cn } from "@/lib/utils"

// Tombol dasar (turunan shadcn/ui). Semua varian & ukuran dipetakan ke token
// tema Editorial Mono (primary/destructive/accent/…), jadi warnanya ikut ganti
// sendiri saat tema terang/gelap tanpa perlu utak-atik di sini.
// Prop `ukuran` sengaja Bahasa Indonesia (bukan `size`) mengikuti gaya penamaan
// project — identifier di NexRoute semua pakai Bahasa Indonesia.
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  ukuran?: "default" | "sm" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ukuran = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
          ukuran === "default" && "h-9 px-4 py-2",
          ukuran === "sm" && "h-8 rounded-md px-3 text-xs",
          ukuran === "icon" && "h-9 w-9",
          variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
          variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          variant === "outline" && "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
          variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
          variant === "link" && "text-primary underline-offset-4 hover:underline",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export { Button }
