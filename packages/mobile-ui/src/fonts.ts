import { createContext, useContext } from 'react';

import { fontFamily } from './theme';

/** Font assets bundled from the Pretendard OFL release. Loaded by <MobileProviders/>; system font is the fallback. */
export const fontAssets = {
  [fontFamily.regular]: require('../assets/fonts/Pretendard-Regular.otf'),
  [fontFamily.semibold]: require('../assets/fonts/Pretendard-SemiBold.otf'),
  [fontFamily.bold]: require('../assets/fonts/Pretendard-Bold.otf'),
};

export const FontsReadyContext = createContext(false);
export const useFontsReady = () => useContext(FontsReadyContext);
