# Visual Asset Provenance

Research date: 2026-08-24.

## Current Decision

The preview does not embed official Apple or Google visual assets. Its status
indicators, hardware overlays, system controls, gesture feedback, and safe-area
guides are generic DOM/CSS primitives generated for this project. They are
deliberately approximate rather than pixel-perfect copies of operating-system
artwork.

Five unexplained iOS-style SVG paths previously represented the time, cellular,
Wi-Fi, and battery indicators. They were removed because their origin and
licence could not be demonstrated.

Device geometry is a separate accuracy question. Current viewport, DPR,
safe-area, and Galaxy A54 cutout values are backed by the reviewed physical
captures under `docs/research/device-geometry-measurements/`. Illustrative
operating-system artwork remains approximate.

## Geometry Probe Scaffolding

The non-published app under `tools/geometry-probe` contains default Capacitor
launcher icons and splash images copied verbatim by `@capacitor/cli` 8.5.0 from
its packaged iOS and Android templates. They identify only the maintainer's
measurement harness, not the public preview product. Capacitor is MIT-licensed;
the upstream copyright and licence are preserved in
`tools/geometry-probe/THIRD_PARTY_NOTICES.md`.

## Platform Asset Boundaries

Apple's Design Resources licence grants limited use for Apple-platform UI
mock-ups and says the resources may not be embedded in software products. This
repository therefore does not redistribute Apple Design Resources or exported
SF Symbols.

Google publishes Material Symbols and Material Icons under Apache-2.0 and
permits their use in products. If an official Material asset is added later,
record its exact source, version, icon name, modifications, and Apache-2.0
notice instead of treating it as project-generated artwork.

Sources:

- Apple, "Apple Design Resources License":
  <https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf>
- Apple, "SF Symbols": <https://developer.apple.com/sf-symbols/>
- Google, "Material Design Icons":
  <https://github.com/google/material-design-icons>
- Google Fonts, "Material Icons Guide":
  <https://developers.google.com/fonts/docs/material_icons>
