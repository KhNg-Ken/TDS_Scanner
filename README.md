# TDS_Scanner

This repository is configured to build with Java 21 (LTS).

Local build instructions

- Install a JDK 21 distribution (Temurin, Adoptium, or other). Ensure `java -version` shows `21`.
- From the repository root, run:

```bash
cd android
./gradlew assembleDebug
```

CI

- A GitHub Actions workflow is included at `.github/workflows/ci-java21.yml` that sets up Java 21 and runs a Gradle build in the `android` folder.
- Note: Building Android on hosted runners may require additional Android SDK packages and license acceptance; extend the workflow with SDK setup steps if necessary.

CI notes

- The included workflow at `.github/workflows/ci-java21.yml` now installs Android SDK packages required for a Gradle Android build when running on GitHub-hosted `ubuntu-latest` runners (it uses `reactivecircus/android-emulator-runner` to provision SDK/platform-tools/build-tools and accept licenses).

If you want me to also pin `org.gradle.java.home` in `android/gradle.properties` or customize the workflow to install specific Android SDK components, tell me and I'll apply those changes.
