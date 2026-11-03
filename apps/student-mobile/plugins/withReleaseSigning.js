/**
 * Hangyul release signing, as a config plugin.
 *
 * V18 first wired this by hand-editing `android/app/build.gradle` after `expo prebuild`. That works
 * exactly once: `prebuild --clean` regenerates the folder and the signing config disappears, so the next
 * person to build gets a debug-signed "release" APK and no error telling them so. The project stays CNG
 * (app.json is the source of truth, `android/` is build output) and this plugin re-applies the change on
 * every prebuild.
 *
 * The keystore itself is never created here and never committed. Gradle reads its location and passwords
 * from properties — supplied by `android/gradle.properties` locally, or by EAS credentials in the cloud —
 * and falls back to the debug keystore when they are absent, so a fresh checkout still builds.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_CONFIG = `
        release {
            if (project.hasProperty('HANGYUL_UPLOAD_STORE_FILE')) {
                storeFile file(HANGYUL_UPLOAD_STORE_FILE)
                storePassword HANGYUL_UPLOAD_STORE_PASSWORD
                keyAlias HANGYUL_UPLOAD_KEY_ALIAS
                keyPassword HANGYUL_UPLOAD_KEY_PASSWORD
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('HANGYUL_UPLOAD_STORE_FILE')) return cfg;

    // 1. add a `release` entry beside the template's `debug` signing config
    const debugBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;
    if (!gradle.includes(debugBlock)) {
      throw new Error('withReleaseSigning: the expo android template no longer has the signingConfigs.debug block this plugin edits');
    }
    gradle = gradle.replace(debugBlock, debugBlock.replace(/\n    \}$/, `\n${SIGNING_CONFIG}    }`));

    // 2. point the release build type at it instead of at the debug key
    const releaseUsesDebug = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
    if (!gradle.includes(releaseUsesDebug)) {
      throw new Error('withReleaseSigning: buildTypes.release no longer matches the expo template this plugin edits');
    }
    gradle = gradle.replace(releaseUsesDebug, `        release {
            signingConfig signingConfigs.release`);

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
