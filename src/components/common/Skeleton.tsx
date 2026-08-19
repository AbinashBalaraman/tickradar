interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-bg-tertiary ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
      <div className="flex items-center gap-2.5 flex-1">
        <Skeleton className="w-5 h-5 rounded-md" />
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="w-16 h-5 rounded" />
        <div className="flex flex-col gap-1.5 items-end">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2.5 w-14" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTableRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3 flex items-center justify-between border-b border-border/60"
        >
          <div className="flex items-center gap-2.5 flex-1">
            <Skeleton className="w-7 h-7 rounded-lg" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </>
  );
}
