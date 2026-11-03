/** Lazy chart wrappers — Recharts ships in its own chunk and loads only on analytics screens. */
import { Skeleton } from '@hangyul/ui';
import { lazy, Suspense, type ComponentProps } from 'react';

const load = () => import('@hangyul/ui/charts');
const LColumn = lazy(() => load().then((m) => ({ default: m.ColumnChart })));

type Of<T> = T extends React.LazyExoticComponent<infer C> ? ComponentProps<C> : never;

const Fallback = ({ h = 240 }: { h?: number }) => <Skeleton h={h} r={12} />;

export function ColumnChart(p: Of<typeof LColumn>) {
  return <Suspense fallback={<Fallback h={p.height ?? 260} />}><LColumn {...p} /></Suspense>;
}
