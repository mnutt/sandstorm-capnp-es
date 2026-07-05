import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  WebRequest,
  cachePolicy,
  cacheScopes,
  clientError,
  clientErrors,
  content,
  cookie,
  createWebSession,
  download,
  etag,
  html,
  json,
  matchesNoneOf,
  methodNotAllowed,
  noContent,
  normalizePath,
  normalizeWebRequest,
  preconditionFailed,
  readData,
  redirect,
  serverError,
  success,
  text,
} from "../dist/web.js";

function list(items) {
  return {
    toArray() {
      return items;
    },
  };
}

function data(text) {
  const bytes = new TextEncoder().encode(text);
  return {
    toUint8Array() {
      return bytes;
    },
  };
}

function requestParams() {
  const context = {
    _hasCookies: () => true,
    cookies: list([
      { key: "theme", value: "dark" },
      { key: "session", value: "abc" },
    ]),
    _hasAdditionalHeaders: () => true,
    additionalHeaders: list([{ name: "x-demo", value: "1" }]),
    _hasAccept: () => true,
    accept: list([{ mimeType: "application/json", qValue: 1000 }]),
    _hasAcceptEncoding: () => true,
    acceptEncoding: list([{ contentCoding: "br", qValue: 900 }]),
    eTagPrecondition: {
      _isMatchesNoneOf: true,
      matchesNoneOf: list([{ value: "abc", weak: false }]),
    },
  };

  return {
    path: "/notes/",
    ignoreBody: false,
    _hasContent: () => true,
    content: {
      mimeType: "application/x-www-form-urlencoded",
      _hasContent: () => true,
      content: data("text=hello"),
    },
    _hasContext: () => true,
    context,
  };
}

describe("web response helpers", () => {
  test("creates content responses with common options", () => {
    const response = html("<p>Hello</p>", {
      etag: "abc",
      cacheScope: "perSession",
      headers: { "X-Demo": "1" },
      cookies: [cookie("seen", "yes", { maxAgeSeconds: 60 })],
    });

    expect(response.content.statusCode).toBe(success.ok);
    expect(response.content.mimeType).toBe("text/html; charset=utf-8");
    expect(response.content.eTag).toEqual({ value: "abc", weak: false });
    expect(response.content.body.bytes).toBeInstanceOf(Uint8Array);
    expect(response.content.disposition).toEqual({ normal: true });
    expect(response.cachePolicy.withCheck).toBe(cacheScopes.perSession);
    expect(response.additionalHeaders).toEqual([{ name: "x-demo", value: "1" }]);
    expect(response.setCookies[0].expires.relative).toBe(60n);
  });

  test("creates json, text, download, and generic content responses", () => {
    const jsonResponse = json({ ok: true });
    expect(jsonResponse.content.mimeType).toBe("application/json; charset=utf-8");
    expect(readData(jsonResponse.content.body.bytes)).toBe('{"ok":true}');

    const prettyJsonResponse = json({ ok: true }, { pretty: true });
    expect(readData(prettyJsonResponse.content.body.bytes)).toContain("\n");

    expect(json('{"already":"encoded"}').content.body.bytes).toBeInstanceOf(
      Uint8Array,
    );
    expect(text("hello").content.mimeType).toBe("text/plain; charset=utf-8");
    const ignored = text("hello", { ignoreBody: true });
    expect(ignored.content.body).toBeUndefined();
    expect(download("file", "demo.txt").content.disposition).toEqual({
      download: "demo.txt",
    });
    expect(content("raw").content.mimeType).toBe("application/octet-stream");
  });

  test("creates control and error responses", () => {
    expect(noContent({ etag: "next" }).noContent.eTag.value).toBe("next");
    expect(noContent({ shouldResetForm: true }).noContent.shouldResetForm).toBe(
      true,
    );
    expect(redirect("next", { permanent: true, switchToGet: false }).redirect).toMatchObject({
      location: "next",
      isPermanent: true,
      switchToGet: false,
    });
    expect(clientError("notFound", "Missing").clientError.statusCode).toBe(
      clientErrors.notFound,
    );
    const nonHtmlError = clientError("badRequest", "Bad", {
      body: "plain",
      mimeType: "text/plain",
    });
    expect(readData(nonHtmlError.clientError.nonHtmlBody.data)).toBe("plain");
    expect(nonHtmlError.clientError.nonHtmlBody.mimeType).toBe("text/plain");
    expect(methodNotAllowed().clientError.statusCode).toBe(
      clientErrors.methodNotAllowed,
    );
    expect(serverError("Oops").serverError.descriptionHtml).toContain("Oops");
    expect(preconditionFailed("abc").preconditionFailed.matchingETag.value).toBe(
      "abc",
    );
  });

  test("normalizes helper primitives", () => {
    expect(normalizePath("/a/b/")).toBe("a/b");
    expect(readData(data("hello"))).toBe("hello");
    expect(etag({ value: "abc", weak: true })).toEqual({
      value: "abc",
      weak: true,
    });
    expect(cachePolicy("perUser", { variesOnAccept: true })).toMatchObject({
      withCheck: cacheScopes.perUser,
      variesOnAccept: true,
    });
    expect(cachePolicy("unknown").withCheck).toBe(cacheScopes.none);
    expect(cachePolicy(cacheScopes.perAppVersion).withCheck).toBe(
      cacheScopes.perAppVersion,
    );
    expect(readData(new TextEncoder().encode("bytes"))).toBe("bytes");
    expect(readData(new TextEncoder().encode("buffer").buffer)).toBe("buffer");
  });

  test("creates cookie expiration variants", () => {
    expect(cookie("default", "value").expires.relative).toBe(3600n);
    expect(cookie("relative", "value", { maxAgeSeconds: 5 }).expires.relative).toBe(
      5n,
    );
    expect(
      cookie("absolute", "value", {
        expires: new Date("2026-01-01T00:00:00.000Z"),
      }).expires.absolute,
    ).toBe(1767225600n);
    expect(
      cookie("flags", "value", {
        path: "/demo",
        domain: "example.test",
        httpOnly: false,
        secure: true,
      }),
    ).toMatchObject({
      path: "/demo",
      domain: "example.test",
      httpOnly: false,
      secure: true,
    });
  });
});

describe("WebRequest", () => {
  test("normalizes request values lazily", () => {
    const params = requestParams();
    const sessionParams = {
      _hasBasePath: () => true,
      basePath: "https://example.test/root",
      userAgent: "agent",
      _hasAcceptableLanguages: () => true,
      acceptableLanguages: list(["en-US"]),
    };

    const request = normalizeWebRequest("post", params, sessionParams);

    expect(request).toBeInstanceOf(WebRequest);
    expect(request.method).toBe("post");
    expect(request.path).toBe("notes");
    expect(request.rawPath).toBe("/notes/");
    expect(request.session.acceptableLanguages).toEqual(["en-US"]);
    expect(request.headers).toEqual({ "x-demo": "1" });
    expect(request.cookies).toEqual({ theme: "dark", session: "abc" });
    expect(request.accept).toEqual([
      { mimeType: "application/json", qValue: 1000 },
    ]);
    expect(request.acceptEncoding).toEqual([
      { contentCoding: "br", qValue: 900 },
    ]);
    expect(request.hasBody).toBe(true);
    expect(request.text()).toBe("text=hello");
    expect(request.formData().get("text")).toBe("hello");
    expect(() => request.json()).toThrow(SyntaxError);
    expect(request.accepts("application/json")).toBe(true);
    expect(request.matchesNoneOf("abc")).toBe(true);
  });

  test("handles missing optional request data", () => {
    const request = new WebRequest("get", {
      path: "",
      ignoreBody: true,
      _hasContext: () => false,
      _hasContent: () => false,
    });

    expect(request.path).toBe("");
    expect(request.headers).toEqual({});
    expect(request.cookies).toEqual({});
    expect(request.hasBody).toBe(false);
    expect(request.bytes()).toHaveLength(0);
    expect(request.text()).toBe("");
    expect(matchesNoneOf(undefined, "abc")).toBe(false);
    expect(matchesNoneOf({ eTagPrecondition: { _isMatchesNoneOf: false } }, "abc")).toBe(
      false,
    );
    expect(
      matchesNoneOf(
        {
          eTagPrecondition: {
            _isMatchesNoneOf: true,
            matchesNoneOf: list([{ value: "other", weak: false }]),
          },
        },
        "abc",
      ),
    ).toBe(false);
  });
});

describe("createWebSession", () => {
  test("wraps handlers with normalized requests", () => {
    const params = requestParams();
    const session = createWebSession({
      get(request, rawParams) {
        expect(rawParams).toBe(params);
        return text(request.path);
      },
    });

    const response = session.get(params);
    expect(response.content.mimeType).toBe("text/plain; charset=utf-8");
    expect(readData(response.content.body.bytes)).toBe("notes");
  });

  test("defaults unsupported methods", async () => {
    const session = createWebSession();

    for (const method of [
      "get",
      "post",
      "put",
      "delete",
      "patch",
      "propfind",
      "proppatch",
      "mkcol",
      "copy",
      "move",
      "lock",
      "unlock",
      "acl",
      "report",
    ]) {
      expect(session[method]({}).clientError.statusCode, method).toBe(
        clientErrors.methodNotAllowed,
      );
    }

    await expect(session.openWebSocket({})).rejects.toMatchObject({
      code: "unimplemented",
    });
    await expect(session.postStreaming({})).rejects.toMatchObject({
      code: "unimplemented",
    });
    await expect(session.putStreaming({})).rejects.toMatchObject({
      code: "unimplemented",
    });
    expect(session.options({})).toEqual({
      davClass1: false,
      davClass2: false,
      davClass3: false,
      davExtensions: [],
    });
  });

  test("uses custom option and streaming handlers", async () => {
    const session = createWebSession({
      options() {
        return {
          davClass1: true,
          davClass2: false,
          davClass3: false,
          davExtensions: ["demo"],
        };
      },
      openWebSocket(request) {
        return { protocol: [request.path] };
      },
      postStreaming(request) {
        return { stream: request.path };
      },
      putStreaming(request) {
        return { stream: request.path };
      },
    });

    expect(session.options({ path: "" }).davClass1).toBe(true);
    expect(await session.openWebSocket({ path: "ws", _hasContext: () => false })).toEqual({
      protocol: ["ws"],
    });
    expect(await session.postStreaming({ path: "post", _hasContext: () => false })).toEqual({
      stream: "post",
    });
    expect(await session.putStreaming({ path: "put", _hasContext: () => false })).toEqual({
      stream: "put",
    });
  });
});

describe("published web entry", () => {
  test("does not statically import generated bindings or the runtime", () => {
    const source = readFileSync(new URL("../dist/web.js", import.meta.url), "utf8");

    expect(source).not.toMatch(/from "\.\/sandstorm\//);
    expect(source).not.toMatch(/from "@mnutt\/capnp-es"/);
    expect(source).toContain('await import("@mnutt/capnp-es")');
  });
});
