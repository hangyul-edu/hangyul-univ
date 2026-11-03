# V19 native evidence — deliberately empty

There are no native screenshots in this directory because **V19 did no native work**. The directory exists
because the brief named it; leaving it empty with nothing to explain the emptiness would read as a capture
step that failed, which is not what happened.

See REPORT §194 (audit) and §202 (validation). In short:

- The host **does** have the Android toolchain: `/root/android-sdk` with build-tools 35/36, platform
  android-36, the NDK and three AVDs (`hangyul-pixel7`, `hangyul-qa`, `hg35`). Tooling was not the blocker.
- `npx expo-doctor` → **21/21 checks passed**, run this pass. That is the only native check V19 ran.
- `npx eas-cli whoami` → **"Not logged in"**. Every iOS artifact, including the Apple-membership-free
  simulator build, stays blocked on the owner.
- The committed `result/student-mobile/android/*.apk|.aab` were built at `2026-10-20T06:16:29Z` and are now
  **stale with respect to source**: V19 changed `packages/api-client` (the request deadline, §199.6), which
  the native app bundles. They were not rebuilt, their checksums were not recomputed, and no claim is made
  that they match the tree.

The V18 gaps — native profile editing, the essay surface, the typography scale, the accessibility sweep,
the payment deep-link matrix and signed-in runtime verification — are **all still open**, and are carried
as the largest locally-solvable item in §209.3.
