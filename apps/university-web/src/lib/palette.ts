/**
 * Series colours for the university console (V6): the validated console categorical palette from
 * packages/ui/src/styles/console.css (`--hg-chart-1…4`: cobalt · teal · violet · ochre — the same values CHART_COLORS
 * resolves to on a console surface). Tangerine never appears in a console chart; red/amber/green are reserved for state.
 * Single-series charts use SERIES[0] (cobalt).
 */
const FALLBACK = ['#3366DD', '#129181', '#8A5ED4', '#BC8516'] as const;

function token(i: number): string {
  if (typeof document === 'undefined') return FALLBACK[i];
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--hg-chart-${i + 1}`).trim();
  return v || FALLBACK[i];
}

export const SERIES = [token(0), token(1), token(2), token(3)] as const;
