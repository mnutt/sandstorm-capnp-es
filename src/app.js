// @ts-nocheck

import { CapnpRpcError } from "@mnutt/capnp-es";
import { connectNodeRpc } from "@mnutt/capnp-es/node";
import { MainView, SandstormApi } from "./sandstorm/grain.js";
import { WebSession } from "./sandstorm/web-session.js";
import { createWebSession } from "./web.js";

export function isWebSession(params) {
  return params?.sessionType === WebSession._capnp.typeId;
}

export function webSession(handlers, options = {}) {
  return (params) =>
    createWebSession(handlers, { sessionParams: params?.sessionParams });
}

export function mainView(options = {}) {
  const createSession =
    options.createSession ??
    ((params) => {
      const target =
        typeof options.webSession === "function"
          ? options.webSession(params)
          : options.webSession;
      if (!target) {
        throw new CapnpRpcError("WebSession is not configured", {
          code: "unimplemented",
        });
      }
      return new WebSession.Server(target).client();
    });

  function newSession(params) {
    if (!isWebSession(params)) {
      throw new CapnpRpcError("Only WebSession is supported", {
        code: "unimplemented",
      });
    }
    const session = createSession(params);
    if (session && typeof session.then === "function") {
      return session.then((resolvedSession) => ({ session: resolvedSession }));
    }
    return { session };
  }

  return {
    getViewInfo() {
      if (typeof options.getViewInfo === "function") {
        return options.getViewInfo();
      }
      return options.viewInfo ?? {};
    },

    newSession,

    newRequestSession(params) {
      return newSession(params);
    },

    newOfferSession(params) {
      return newSession(params);
    },

    restore(params, results) {
      if (typeof options.restore === "function") {
        return options.restore(params, results);
      }
      throw new CapnpRpcError("No app-owned persistent objects are configured", {
        code: "unimplemented",
      });
    },

    drop(params, results) {
      if (typeof options.drop === "function") {
        return options.drop(params, results);
      }
    },
  };
}

export async function serveSandstormApp(options = {}) {
  const conn =
    options.conn ?? (await connectNodeRpc(options.connect ?? { fd: options.fd ?? 3 }));
  const target =
    options.mainView?.getViewInfo || options.mainView?.newSession
      ? options.mainView
      : mainView(options.mainView ?? options);

  conn.initMain(MainView, target);
  conn.onError =
    options.onError ??
    ((error) => {
      if (error) {
        console.error(error);
      }
    });

  if (options.bootstrapSandstormApi !== false) {
    try {
      conn.sandstormApi = conn.bootstrap(SandstormApi);
    } catch (error) {
      if (typeof options.onBootstrapError === "function") {
        options.onBootstrapError(error);
      }
    }
  }

  return conn;
}
