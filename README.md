# TDS_Scanner

This repository is configured to build with Java 21 (LTS).

Local build instructions

-   Install a JDK 21 distribution (Temurin, Adoptium, or other). Ensure `java -version` shows `21`.
-   From the repository root, run:

```bash
cd android
./gradlew assembleDebug
```

CI

-   A GitHub Actions workflow is included at `.github/workflows/ci-java21.yml` that sets up Java 21 and runs a Gradle build in the `android` folder.
-   Note: Building Android on hosted runners may require additional Android SDK packages and license acceptance; extend the workflow with SDK setup steps if necessary.

CI notes

-   The CI workflow no longer provisions an emulator. It still sets up Java 21 and runs the Gradle Android build.

Run on a physical device (recommended for camera apps)

-   Android (recommended):
    1.  Connect your Android device via USB and enable Developer Options + USB Debugging.
    2.  From the project root, run:

```bash
npx expo run:android
```

    - This builds a development client and installs it on the connected device. Once installed, start Metro with `npx expo start` and scan the QR code or use `--tunnel` if your device is on a different network.

-   iOS (recommended for camera testing on iPhone):
    -   On macOS with Xcode installed, connect your device and run:

```bash
npx expo run:ios
```
