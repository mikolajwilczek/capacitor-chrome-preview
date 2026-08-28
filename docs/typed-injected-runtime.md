# Typed Injected Runtime Findings

Date: 2026-06-27

## Context

The preview prototype needs to send JavaScript source text to Chrome through CDP:

- `Page.addScriptToEvaluateOnNewDocument` for pre-navigation runtime install.
- `Runtime.evaluate` for reinjection into an already loaded page.

The browser requires a string at this boundary. Hand-written string templates
would leave the injected logic outside normal TypeScript checks and make
refactoring fragile.

## Finding

Use TypeScript everywhere except the final CDP source boundary.

Implementation rules:

1. Keep preview state as shared TypeScript types.
2. Write the injected browser runtime as normal TypeScript functions.
3. Split the runtime into standalone TypeScript factories for styles, UI, navigation, and lifecycle.
4. Compile and type-check those factories with the rest of the project.
5. Serialize the factories with `Function.prototype.toString()` only at the final CDP call.
6. Pass device/profile data as a JSON-serialized argument.

Only the final serialization step leaves typed source code.

## Current Implementation

The shared profile model lives in `src/types.ts`.

The CLI profile uses `satisfies PreviewDevice`, so missing safe-area, Dynamic Island, status bar, or debug fields fail during type-checking.

`src/injected-runtime.ts` is the small public facade and composition boundary. The browser-side
implementation is split under `src/injected-runtime/`:

- `styles/` separates shared overlay, iOS, and Android CSS. Its `css` tagged templates enable
  CSS-in-template syntax highlighting in editors that support the common tag convention.
- `ui.ts` creates and repairs overlay DOM.
- `navigation/` separates shared input capture, Back/Ionic dispatch, three-button interaction, and
  edge-gesture interaction.
- `lifecycle.ts` owns rendering, DOM observation, safe-area variables, and cleanup.
- `types.ts` contains types used only across injected runtime modules.

The facade exports:

- `installPreviewRuntime(device)`
- `resetPreviewRuntime()`
- `createInstallPreviewRuntimeSource(device)`

The CLI asks the facade for one self-contained source string:

```ts
export function createRuntimeSource(device: PreviewDevice): string {
  return createInstallPreviewRuntimeSource(device);
}
```

The returned source contains the installer plus the grouped style, UI,
navigation, and lifecycle factories as explicit dependencies. No other module
builds runtime logic as source text.

## Project-Generated Status Bar

The earlier runtime contained five unexplained iOS-style SVG paths. They were
removed rather than publishing vector data whose origin and licence could not
be demonstrated.

The status bar is now assembled from typed DOM nodes and generic CSS primitives:

- normal text for a fixed preview time;
- four rectangular cellular bars;
- CSS radial gradients for a generic Wi-Fi indicator;
- CSS borders and fills for a generic battery indicator.

These indicators are intentionally approximate. They provide the layout signal
needed by the preview without embedding Apple design resources or claiming
pixel-perfect system artwork.

## Constraints

`Function.prototype.toString()` only carries the function body being serialized. Each injected
factory must therefore remain standalone: it may use type-only imports, browser globals, arguments,
and helpers declared inside the factory, but not imported runtime values. The facade composes the
serialized factories explicitly, so source modules stay small without adding a bundler dependency.

The CDP TypeScript types may lag experimental Chrome APIs. `Emulation.setSafeAreaInsetsOverride` currently needs a narrow local type wrapper instead of weakening the whole CDP client to `any`.

## Type-Safety Boundary

TypeScript checks:

- device profile changes
- injected runtime DOM logic
- reset behavior
- visual asset definitions before serialization

CDP receives the required source string only after these checks.

## Verification

Useful checks:

```sh
npm run typecheck
npm run build
```

The automated runtime suite executes the serialized source in a DOM environment. This verifies that
the composed runtime does not accidentally depend on Node module scope before Chrome receives it.
