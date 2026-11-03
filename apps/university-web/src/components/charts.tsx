import { Skeleton } from '@hangyul/ui';
import { lazy, Suspense, type ComponentProps } from 'react';

/** Charts are always code-split (Recharts is heavy). Each wrapper reserves its height so the layout doesn't jump. */
const Column = lazy(() => import('@hangyul/ui/charts').then((m) => ({ default: m.ColumnChart })));

const Fallback = ({ h }: { h: number }) => <Skeleton h={h} r={12} />;

export function ColumnChart(props: ComponentProps<typeof Column>) {
  return <Suspense fallback={<Fallback h={props.height ?? 260} />}><Column {...props} /></Suspense>;
}
