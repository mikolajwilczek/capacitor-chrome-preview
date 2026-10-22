# Dependency maintenance review

Research and validation date: 2026-10-22. Versions compare the original
committed lockfiles with the reviewed updates.

## Kept updates

| Dependency | Before | After |
| --- | --- | --- |
| Ink | 7.1.1 | 8.0.0 |
| React / React types | 19.2.8 / 19.2.18 | 19.3.1 / 19.3.0 |
| Node types | 24.13.3 | 24.19.2 |
| jsdom | 30.0.1 | 30.1.3 |
| undici, through jsdom | 8.10.0 | 8.12.3 |
| actions/setup-node | 7.0.0 | 7.1.0 |
| Probe Capacitor core, CLI, Android, iOS | 8.5.0 | 8.5.3 |
| Probe Filesystem / Share | 8.1.3 / 8.0.1 | 8.1.5 / 8.0.3 |
| Probe brace-expansion, transitive | 5.0.9 | 5.0.12 |
| Probe Gradle wrapper | 8.14.3 | 8.14.6 |
| Probe Temurin JDK | 21.0.6 | 21.0.12.1 |

## Version and security decisions

- [Ink 8](https://github.com/vadimdemedes/ink/releases/tag/v8.0.0) requires
  React and React types 19.3+; update them together. Keep Node types on 24 to
  match the supported runtime. [jsdom 30.1.3](https://github.com/jsdom/jsdom/releases/tag/v30.1.3)
  includes interaction-test fixes beyond the Dependabot PR's 30.1.2 target.
- Keep both workflows pinned to the full commit SHA for
  [setup-node 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0).
- Keep the existing probe `xcode` → `uuid: 11.1.1` override.
  [Capacitor CLI 8.5.3](https://registry.npmjs.org/@capacitor/cli/8.5.3) still
  requests `xcode ^3.0.1`, which otherwise restores affected UUID 7
  ([advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). No additional
  npm overrides are needed.
- Keep Capacitor 8.5.3's Android SDK, AGP, AndroidX, Cordova, and Kotlin defaults
  ([upgrade guide](https://capacitorjs.com/docs/updating/8-0)). Retain the
  [Gradle 8.14.6 security patch](https://docs.gradle.org/8.14.6/release-notes.html),
  verified wrapper JAR, and official `all` distribution SHA-256.
- Keep the tested Temurin 21.0.12.1 pin. [Temurin 21.0.13](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.13%2B9)
  remains an outstanding security update, pending mise catalog support.
- Remove the custom Gradle build-dependency constraints and settings hook.
  Advisory version matches alone did not establish vulnerable functionality
  in this probe's build. Reassess applicability before diverging from upstream.
- Native sync resolves Capacitor 8.5.3 and Filesystem's required
  `ion-ios-filesystem` 2.0.1.
- Dependabot monitors both npm projects and GitHub Actions weekly, grouping
  terminal UI packages and Capacitor packages for compatible updates.

Public behavior expectations remain in
[regression guardrails](../regression-guardrails.md).

## Validation

After removing the Gradle constraints:

- CLI typecheck, build, and all 65 tests pass.
- Probe Android debug and iOS simulator builds pass.
- Gradle configuration-cache validation passes with problems treated as errors.
- Full npm audits report zero vulnerabilities in both projects.
- Workflow/Dependabot YAML parses and `git diff --check` passes.

No physical-device measurements or hosted GitHub Actions runs were performed.
