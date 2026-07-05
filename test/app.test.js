import { describe, expect, test } from "vitest";

import { mainView, serveSandstormApp, webSession, isWebSession } from "../dist/app.js";
import { html, readData } from "../dist/web.js";
import { WebSession } from "../dist/sandstorm/web-session.js";

function list(items) {
  return {
    toArray() {
      return items;
    },
  };
}

function sessionParams() {
  return {
    _hasBasePath: () => true,
    basePath: "https://example.test/root",
    userAgent: "agent",
    _hasAcceptableLanguages: () => true,
    acceptableLanguages: list(["en-US"]),
  };
}

describe("app adapter", () => {
  test("recognizes WebSession session requests", () => {
    expect(isWebSession({ sessionType: WebSession._capnp.typeId })).toBe(true);
    expect(isWebSession({ sessionType: 0n })).toBe(false);
  });

  test("mainView routes WebSession creation", async () => {
    const view = mainView({
      viewInfo: { appTitle: { defaultText: "Demo" } },
      webSession: webSession({
        get(request) {
          return html(request.session.basePath);
        },
      }),
    });

    expect(await view.getViewInfo()).toEqual({
      appTitle: { defaultText: "Demo" },
    });

    const result = await view.newSession({
      sessionType: WebSession._capnp.typeId,
      sessionParams: sessionParams(),
    });

    expect(result.session).toBeTruthy();
    expect(typeof result.session.get).toBe("function");
  });

  test("mainView supports async view info and async custom session creation", async () => {
    const customSession = { get: () => html("custom") };
    const view = mainView({
      getViewInfo: async () => ({ appTitle: { defaultText: "Async" } }),
      createSession: async () => customSession,
    });

    await expect(view.getViewInfo()).resolves.toEqual({
      appTitle: { defaultText: "Async" },
    });
    await expect(
      view.newSession({
        sessionType: WebSession._capnp.typeId,
        sessionParams: sessionParams(),
      }),
    ).resolves.toEqual({ session: customSession });
  });

  test("mainView rejects unsupported session types", () => {
    const view = mainView({ webSession: webSession({}) });

    expect(() => view.newSession({ sessionType: 0n })).toThrow(
      /Only WebSession/,
    );
  });

  test("mainView exposes request, offer, restore, and drop hooks", async () => {
    const calls = [];
    const view = mainView({
      webSession: webSession({}),
      restore(params, results) {
        calls.push(["restore", params, results]);
        return { cap: null };
      },
      drop(params, results) {
        calls.push(["drop", params, results]);
      },
    });

    const sessionRequest = {
      sessionType: WebSession._capnp.typeId,
      sessionParams: sessionParams(),
    };

    await expect(Promise.resolve(view.newRequestSession(sessionRequest))).resolves.toHaveProperty(
      "session",
    );
    await expect(Promise.resolve(view.newOfferSession(sessionRequest))).resolves.toHaveProperty(
      "session",
    );

    const restoreParams = {};
    const restoreResults = {};
    expect(view.restore(restoreParams, restoreResults)).toEqual({ cap: null });
    view.drop({}, {});
    expect(calls.map((call) => call[0])).toEqual(["restore", "drop"]);
  });

  test("mainView restore defaults to unimplemented and drop defaults to no-op", () => {
    const view = mainView({ webSession: webSession({}) });

    expect(() => view.restore({}, {})).toThrow(/No app-owned persistent/);
    expect(view.drop({}, {})).toBeUndefined();
  });

  test("webSession factory threads startup params into requests", () => {
    const target = webSession({
      get(request) {
        return html(request.session.basePath);
      },
    })({ sessionParams: sessionParams() });

    const response = target.get({
      path: "",
      ignoreBody: false,
      _hasContext: () => false,
    });

    expect(readData(response.content.body.bytes)).toBe(
      "https://example.test/root",
    );
  });

  test("serveSandstormApp wires a connection", async () => {
    const initCalls = [];
    const bootstraps = [];
    const conn = {
      initMain(schema, target) {
        initCalls.push({ schema, target });
      },
      bootstrap(schema) {
        bootstraps.push(schema);
        return { api: true };
      },
    };

    const result = await serveSandstormApp({
      conn,
      mainView: {
        viewInfo: { appTitle: { defaultText: "Demo" } },
        webSession: webSession({}),
      },
    });

    expect(result).toBe(conn);
    expect(initCalls).toHaveLength(1);
    expect(typeof initCalls[0].target.newSession).toBe("function");
    expect(bootstraps).toHaveLength(1);
    expect(conn.sandstormApi).toEqual({ api: true });
    expect(typeof conn.onError).toBe("function");
  });

  test("serveSandstormApp can skip SandstormApi bootstrap", async () => {
    let bootstrapCount = 0;
    const conn = {
      initMain() {},
      bootstrap() {
        bootstrapCount++;
      },
    };

    await serveSandstormApp({
      conn,
      mainView: mainView({ webSession: webSession({}) }),
      bootstrapSandstormApi: false,
    });

    expect(bootstrapCount).toBe(0);
  });
});
