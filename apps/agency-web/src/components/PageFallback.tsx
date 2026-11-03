import { Skeleton, SkeletonCard } from '@hangyul/ui';

export function PageFallback() {
  return (
    <div className="hg-stack" aria-busy="true">
      <Skeleton w={260} h={30} />
      <div className="ag-kpis">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={108} r={16} />)}
      </div>
      <SkeletonCard lines={5} />
    </div>
  );
}
