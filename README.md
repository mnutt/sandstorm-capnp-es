# sandstorm-capnp-es

Generated ESM and TypeScript declaration bindings for Sandstorm Cap'n Proto
schemas, built with `@mnutt/capnp-es`.

## Build

This package expects a Sandstorm checkout at `/tmp/sandstorm` by default:

```sh
npm install
npm run build
```

Set `SANDSTORM_SRC` to use a different checkout source directory:

```sh
SANDSTORM_SRC=/path/to/sandstorm/src npm run build
```

Generated files are written to `dist/` and are the published package contents.

## Usage

Raw generated bindings are available by schema path:

```ts
import { MainView } from "sandstorm-capnp-es/sandstorm/grain";
import { WebSession } from "sandstorm-capnp-es/sandstorm/web-session";
```

For app code, prefer the adapter and response helpers:

```ts
import { serveSandstormApp, mainView, webSession } from "sandstorm-capnp-es/app";
import { html, json, methodNotAllowed } from "sandstorm-capnp-es/web";

await serveSandstormApp({
  mainView: mainView({
    viewInfo: {
      appTitle: { defaultText: "My Sandstorm App" },
      permissions: [],
      roles: [],
      deniedPermissions: [],
      matchRequests: [],
      matchOffers: [],
      eventTypes: [],
    },
    webSession: webSession({
      get(request) {
        if (request.path === "status.json") {
          return json({ ok: true });
        }
        return html("<!doctype html><h1>Hello</h1>");
      },
      post() {
        return methodNotAllowed();
      },
    }),
  }),
});
```

The `web` helpers return objects compatible with the generated WebSession schema.
Request wrappers normalize common fields lazily, so lists and request bodies are
only decoded when accessed.
