import { MARKETS } from '@hangyul/i18n';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { FLAG_SVG } from '../flags.generated';

/**
 * A market's flag, sized by **height** with its own width (V17).
 *
 * The same contract as the web's `<Flag>`: each market declares its own `flagRatio`, the artwork is given
 * its true aspect, and every flag is centred in a fixed-width slot so the rows' text stays aligned. Nepal
 * is then a narrow flag rather than a special case — it is the only non-quadrilateral national flag in the
 * world, portrait at roughly 0.82 : 1, and a fixed 20 × 14 crops it into a rectangle.
 *
 * The artwork comes from `flags.generated.ts` rather than from a URL, because Metro has no `public/`
 * directory: the native picker used to render names with an empty space where the flag should be, and the
 * cause was the bundle, not the asset. Decorative — the row's own text names the language.
 */
export function MarketFlag({ code, height = 16 }: { code: string | undefined; height?: number }) {
  const market = code ? MARKETS.find((m) => m.code === code) : undefined;
  const xml = market ? FLAG_SVG[market.asset] : undefined;
  const ratio = market?.flagRatio ?? 1.5;
  // Wide enough for the widest flag (1.5 : 1 is the common ratio) plus a hair, so nothing sits off-centre.
  const slot = Math.round(height * 1.5) + 2;
  return (
    <View style={{ width: slot, height, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      {xml ? <SvgXml xml={xml} width={Math.round(height * ratio)} height={height} /> : null}
    </View>
  );
}
