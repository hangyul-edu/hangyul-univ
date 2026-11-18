import type { NativeStackNavigationOptions } from 'expo-router';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { Platform, Text } from 'react-native';

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
    // Five tabs on a 360pt phone leave ~72pt per label, and many locales are longer than English. The label stays on one
    // line and shrinks to fit (down to 80 %) rather than truncating to "Applicatio…".
    tabBarLabel: ({ color, children }) => (
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} allowFontScaling
        style={[fontsReady ? { fontFamily: fontFamily.semibold } : { fontWeight: '600' }, { color, fontSize: 11, lineHeight: 14, textAlign: 'center' }]}>
        {children}
      </Text>
    ),
    tabBarBadgeStyle: { backgroundColor: theme.color.primary, color: '#FFFFFF' },
    tabBarAllowFontScaling: true,
  };
}
