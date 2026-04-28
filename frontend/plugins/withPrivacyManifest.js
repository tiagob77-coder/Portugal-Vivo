/**
 * withPrivacyManifest — Expo config plugin
 *
 * Copies PrivacyInfo.xcprivacy from the project root into the iOS
 * project bundle during `eas build` / `expo prebuild`. Required by
 * the App Store since May 2024.
 *
 * Usage in app.json:
 *
 *   "plugins": [
 *     ...
 *     "./plugins/withPrivacyManifest.js"
 *   ]
 *
 * The plugin runs in the iOS-config phase, locates
 * `PrivacyInfo.xcprivacy` at the repo root, and writes it to
 * `ios/<AppName>/PrivacyInfo.xcprivacy`. It also adds the file to the
 * Xcode project's Resources copy phase so it ends up inside the
 * shipped .ipa. If the source file is missing the plugin is a no-op
 * (build still succeeds — useful while iterating).
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, IOSConfig } =
  require('@expo/config-plugins');

const SOURCE_FILENAME = 'PrivacyInfo.xcprivacy';

/**
 * Step 1 — Copy PrivacyInfo.xcprivacy from project root into the
 * generated iOS project so the file exists on disk before Xcode tries
 * to bundle it.
 */
const withPrivacyManifestFile = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformProjectRoot = cfg.modRequest.platformProjectRoot;
      const src = path.join(projectRoot, SOURCE_FILENAME);
      if (!fs.existsSync(src)) {
        // Surface a warning but don't break the build — operator can
        // fix and rerun without losing the rest of prebuild.
        // eslint-disable-next-line no-console
        console.warn(
          `[withPrivacyManifest] ${SOURCE_FILENAME} not found at ${src}. ` +
            'Skipping. App Store will reject the submission until this is fixed.'
        );
        return cfg;
      }
      const appName = IOSConfig.XcodeUtils.sanitizedName(cfg.name);
      const dest = path.join(platformProjectRoot, appName, SOURCE_FILENAME);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      return cfg;
    },
  ]);

/**
 * Step 2 — Tell Xcode to include the file as a resource, otherwise
 * `xcodebuild` ignores it and the .ipa ships without the manifest.
 */
const withPrivacyManifestResource = (config) =>
  withXcodeProject(config, async (cfg) => {
    const project = cfg.modResults;
    const appName = IOSConfig.XcodeUtils.sanitizedName(cfg.name);
    const filePath = `${appName}/${SOURCE_FILENAME}`;
    try {
      // addResourceFile is idempotent — re-adding silently no-ops.
      project.addResourceFile(
        filePath,
        { target: project.getFirstTarget().uuid }
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[withPrivacyManifest] Failed to register resource in Xcode project:',
        err.message
      );
    }
    return cfg;
  });

module.exports = (config) =>
  withPrivacyManifestResource(withPrivacyManifestFile(config));
