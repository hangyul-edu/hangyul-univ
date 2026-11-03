/**
 * V25 (REPORT §313 S9, brief §31): the native app shows the same licensed campus photograph the web does — on the next
 * action and beside each application — instead of a bare text row. The image is served by the student web origin (the
 * same files, same renditions); a university with no photograph shows nothing rather than a placeholder. CC BY/BY-SA
 * photographs carry their credit on the picture, as on the web.
 */
import { AppText, theme } from '@hangyul/mobile-ui';
import type { UniversityPhotoRef } from '@hangyul/types';
import { Image, StyleSheet, View } from 'react-native';

import { getWebAppUrl } from './plan';

const uri = (p: UniversityPhotoRef, w: 640 | 1200) => `${getWebAppUrl()}/${p.local_path}-${w}.jpg`;

/** A full-width campus banner (4:5 crops are the web's job; native shows 16:9 at the landscape focal point). */
export function CampusBanner({ photo, name }: { photo?: UniversityPhotoRef | null; name: string }) {
  if (!photo?.local_path) return null;
  return (
    <View style={styles.banner} accessible accessibilityRole="image" accessibilityLabel={name}>
      <Image source={{ uri: uri(photo, 1200) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.caption}>
        <AppText variant="caption" weight="semibold" color="#FFFFFF" numberOfLines={1}>
          {name}{photo.attribution ? ` · ${photo.attribution.author} · ${photo.attribution.license}` : ''}
        </AppText>
      </View>
    </View>
  );
}

/** A small campus thumbnail for list rows. */
export function CampusThumb({ photo }: { photo?: UniversityPhotoRef | null }) {
  if (!photo?.local_path) return null;
  return <Image source={{ uri: uri(photo, 640) }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />;
}

const styles = StyleSheet.create({
  banner: { height: 168, borderRadius: theme.radius.xl, overflow: 'hidden', backgroundColor: theme.color.surfaceSunken, justifyContent: 'flex-end' },
  caption: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.38)' },
  thumb: { width: 56, height: 42, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceSunken },
});
