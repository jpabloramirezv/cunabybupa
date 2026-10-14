import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Brand({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn('leading-tight', className)}>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'text-3xl font-extrabold leading-none tracking-wider',
            inverted ? 'text-navy-foreground' : 'text-navy',
          )}
        >
          CUNA
        </span>
        <span
          className={cn(
            'text-sm font-medium italic',
            inverted ? 'text-navy-foreground/80' : 'text-muted-foreground',
          )}
        >
          by
        </span>
        <span className={cn(inverted && 'rounded-md bg-card px-2 py-1')}>
          <Image
            src="/brand/bupa-logo.png"
            alt="Bupa"
            width={920}
            height={409}
            priority
            className={cn('w-auto', inverted ? 'h-6' : 'h-9')}
          />
        </span>
      </div>
      <p className={cn('mt-1.5 text-xs', inverted ? 'text-navy-foreground/80' : 'text-muted-foreground')}>
        Neonatología · Clínica Bupa Reñaca
      </p>
    </div>
  )
}
