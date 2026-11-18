import type { NativeStackNavigationOptions } from 'expo-router';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { Platform } from 'react-native';

import { fontFamily, theme } from '../theme';

/** Default native-stack options: platform back button, tangerine tint, flat header. */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerTintColor: theme.color.primaryText,
  headerTitleStyle: { color: theme.color.text },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: theme.color.bg },
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: theme.color.bg },
  animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
};

/** Tab navigator options. Tab roots render their own large titles (<Screen title>), so the JS header is hidden. */
export function tabScreenOptions(fontsReady: boolean): BottomTabNavigationOptions {
  return {
    headerShown: false,
    // Current tab = the tangerine text colour (5.2:1 on white); the rest secondary ink, as on the web tab bar.
    tabBarActiveTintColor: theme.color.selected.fg,
    tabBarInactiveTintColor: theme.color.textSecondary,
    // Native bars size themselves around the safe area; the web preview (react-native-web) needs explicit room so labels aren't clipped.
    tabBarStyle: Platform.OS === 'web'
      ? { backgroundColor: theme.color.surface, borderTopColor: theme.color.border, height: 60, paddingTop: 6, paddingBottom: 8 }
      : { backgroundColor: theme.color.surface, borderTopColor: theme.color.border },
    tabBarLabelStyle: fontsReady ? { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 14 } : { fontWeight: '600', fontSize: 11, lineHeight: 14 },
    tabBarBadgeStyle: { backgroundColor: theme.color.primary, color: '#FFFFFF' },
    tabBarAllowFontScaling: true,
  };
}
