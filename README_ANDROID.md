# VANTÉRA Official Android Native App (Capacitor)
**Package ID:** `com.vantera.store`  
**Application Name:** VANTÉRA  
**Slogan:** Technology, Elevated.  

---

## Prerequisites
1. Android Studio (Ladybug / Koala / Hedgehog or newer) OR Android SDK Command-line Tools.
2. JDK 17 or JDK 21 configured in JAVA_HOME.

---

## Build Options

### Option A: Android Studio GUI (Recommended)
1. Open Android Studio.
2. Select **Open an Existing Project** and choose the `android` directory from this extracted folder.
3. Wait for Gradle Sync to complete.
4. Select your connected Android phone or Android Emulator.
5. Click **Run (Shift+F10)**.

### Option B: Command Line (Gradle Debug APK)
```bash
cd android
./gradlew assembleDebug
```
The generated APK will be available at:
`android/app/build/outputs/apk/debug/app-debug.apk`

To install directly to a connected USB Android phone with developer mode enabled:
```bash
./gradlew installDebug
```

### Option C: Production Release for Google Play Store (AAB)
```bash
cd android
./gradlew bundleRelease
```
The generated bundle will be available at:
`android/app/build/outputs/bundle/release/app-release.aab`
