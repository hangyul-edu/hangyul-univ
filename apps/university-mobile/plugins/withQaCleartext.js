/**
 * V23 — QA preview builds only: allow cleartext HTTP so an installed preview APK can reach a local development API
 * (`http://10.0.2.2:8001` from the Android emulator). Applied **only** when `HG_QA_CLEARTEXT=1` is set for the prebuild;
 * the production AAB is built without it, so a store build still refuses cleartext (targetSdk 36 default).
 *
 * V22's signed release APK could never sign in on this host for exactly this reason (REPORT §266 item 1); the V23
 * preview APK carries this flag in BUILD_INFO.json (`qa_cleartext: true`) so nobody mistakes it for a store build.
 */
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withQaCleartext(config) {
  // Written explicitly both ways, so re-running prebuild in the same tree for the production AAB turns it back off
  // (the debug overlay's own `tools:replace` still allows the Metro dev server in debug builds).
  const qa = process.env.HG_QA_CLEARTEXT === '1';
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = qa ? 'true' : 'false';
    return cfg;
  });
};
