# Konomioke Android

Play Store wrapper for [konomioke.com](https://konomioke.com) — peer-to-peer therapeutic karaoke.

## Tech stack
- **Language**: Kotlin
- **Min SDK**: 26 (Android 8.0) — required for WebRTC audio in WebView + AudioFocus V3
- **Target SDK**: 34 (Android 14)
- **WebView** + `WebChromeClient` to handle `getUserMedia` permission natively
- **Foreground service** (`AudioSessionService`) keeps the mic session alive in background
- **Deep-link**: `https://konomioke.com/*` opens inside the app

## Project structure
```
apps/android/
  app/
    src/main/
      java/com/konomioke/app/
        MainActivity.kt          # Full-screen WebView + mic permission flow
        AndroidBridge.kt         # window.KonomiokAndroid JS bridge
        KonomiokApp.kt           # Application subclass
        service/
          AudioSessionService.kt # Foreground service — keeps audio session alive
      res/
        drawable/ic_splash_icon.xml   # Placeholder vector — replace with real artwork
        layout/activity_main.xml
        values/{colors,strings,themes}.xml
        xml/{network_security_config,backup_rules,data_extraction_rules}.xml
      AndroidManifest.xml
    build.gradle
    proguard-rules.pro
  build.gradle
  gradle.properties
  settings.gradle
```

## Build

```bash
# Debug APK
./gradlew assembleDebug

# Release AAB (for Play Store)
./gradlew bundleRelease
```

For release signing set up a keystore and add to `app/build.gradle`:
```groovy
signingConfigs {
    release {
        storeFile file(System.getenv("KEYSTORE_PATH"))
        storePassword System.getenv("KEYSTORE_PASS")
        keyAlias System.getenv("KEY_ALIAS")
        keyPassword System.getenv("KEY_PASS")
    }
}
```

## Play Store checklist
- [ ] Replace `ic_splash_icon.xml` with final artwork (512×512 PNG for store listing, adaptive icon for device)
- [ ] Set up signing keystore + CI secret
- [ ] Add `google-services.json` if Firebase analytics is wanted
- [ ] Add `assetlinks.json` to `konomioke.com/.well-known/` for deep-link verification
- [ ] Fill store listing: description, screenshots, privacy policy URL
- [ ] Test on physical device — especially mic permission flow and background audio

## Deep-link verification
Add to `https://konomioke.com/.well-known/assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.konomioke.app",
    "sha256_cert_fingerprints": ["<YOUR_RELEASE_CERT_SHA256>"]
  }
}]
```
