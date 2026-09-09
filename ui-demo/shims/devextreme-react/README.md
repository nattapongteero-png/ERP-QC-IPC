Plain stand-ins for the `devextreme-react/*` entry points.

DevExtreme is licence-restricted for redistribution, so nothing under
node_modules/devextreme may reach the published demo bundle. Most screens go
through the app's own `@/components/ui/dx-*` wrappers, which the demo aliases
one by one — but a handful of components import the vendor package directly.

A catch-all alias in vite.config.ts sends every `devextreme-react/x` here. If a
screen reaches for one that has no file, the build fails: loud, and far better
than quietly shipping the real thing.
