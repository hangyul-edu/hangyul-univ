import { color, status } from './index';

/**
 * The native Agency and University apps' surface — **the V22 web console's values** (packages/ui/src/styles/console-v22.css).
 *
 * V6–V22 re-pointed the palette here to cobalt (#2257D6); the web consoles left cobalt for white surfaces, ink text and one
 * tangerine action colour in V22, and the native apps stayed behind (REPORT §274 N4–N5). V23 brings them level: white and
 * near-white, hairline borders, tangerine only for the current/primary action, semantic colours only for state.
 * Must run before any StyleSheet is created — import `@hangyul/design-tokens/console-surface` as the app's FIRST import.
 */
export function applyConsoleSurface(): void {
  Object.assign(color as Record<string, unknown>, {
    primary: '#CC4E00', primaryHover: '#B84600', primaryPressed: '#A33E00', primarySubtle: '#FFF1E7', primaryText: '#B84600',
    focus: '#CC4E00', bgCanvas: '#FFFFFF', bgMuted: '#F6F3EE', surfaceWarm: '#F6F3EE', surfaceSunken: '#EFEBE4', surfaceHover: '#F9F7F3',
    border: '#E8E4DD', borderSubtle: '#F0ECE6', borderStrong: '#D6D0C6', text: '#181A1F', textSecondary: '#56524B', textTertiary: '#6A655D',
  });
  Object.assign(status.brand as Record<string, string>, { fg: '#B84600', bg: '#FFF1E7', solid: '#CC4E00' });
}
