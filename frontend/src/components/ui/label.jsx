import { cn } from '../../lib/utils.js';

// ponytail: plain <label>, not Radix Label. Nothing here needs asChild
// or composed peer state, so the dependency isn't worth adding.
export function Label({ className, ...props }) {
  return (
    <label
      className={cn('text-sm leading-none font-medium select-none', className)}
      {...props}
    />
  );
}
