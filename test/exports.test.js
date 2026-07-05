import { describe, expect, test } from "vitest";

describe("package exports", () => {
  test("loads public subpaths", async () => {
    const [root, app, web, grain] = await Promise.all([
      import("sandstorm-capnp-es"),
      import("sandstorm-capnp-es/app"),
      import("sandstorm-capnp-es/web"),
      import("sandstorm-capnp-es/sandstorm/grain"),
    ]);

    expect(typeof root.UiView).toBe("function");
    expect(typeof app.mainView).toBe("function");
    expect(typeof web.html).toBe("function");
    expect(typeof grain.MainView).toBe("function");
  });
});
