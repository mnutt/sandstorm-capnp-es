// @ts-nocheck

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const SUCCESS_OK = 0;
const SUCCESS_CREATED = 1;
const SUCCESS_ACCEPTED = 2;
const SUCCESS_NO_CONTENT = 3;
const SUCCESS_PARTIAL_CONTENT = 4;
const SUCCESS_MULTI_STATUS = 5;
const SUCCESS_NOT_MODIFIED = 6;

const CLIENT_BAD_REQUEST = 0;
const CLIENT_FORBIDDEN = 1;
const CLIENT_NOT_FOUND = 2;
const CLIENT_METHOD_NOT_ALLOWED = 3;
const CLIENT_NOT_ACCEPTABLE = 4;
const CLIENT_CONFLICT = 5;
const CLIENT_GONE = 6;
const CLIENT_PRECONDITION_FAILED = 11;
const CLIENT_REQUEST_ENTITY_TOO_LARGE = 7;
const CLIENT_REQUEST_URI_TOO_LONG = 8;
const CLIENT_UNSUPPORTED_MEDIA_TYPE = 9;
const CLIENT_IM_ATEAPOT = 10;
const CLIENT_UNPROCESSABLE_ENTITY = 12;

const CACHE_NONE = 0;
const CACHE_PER_SESSION = 1;
const CACHE_PER_USER = 2;
const CACHE_PER_APP_VERSION = 3;

export const success = {
  ok: SUCCESS_OK,
  created: SUCCESS_CREATED,
  accepted: SUCCESS_ACCEPTED,
  noContent: SUCCESS_NO_CONTENT,
  partialContent: SUCCESS_PARTIAL_CONTENT,
  multiStatus: SUCCESS_MULTI_STATUS,
  notModified: SUCCESS_NOT_MODIFIED,
};

export const clientErrors = {
  badRequest: CLIENT_BAD_REQUEST,
  forbidden: CLIENT_FORBIDDEN,
  notFound: CLIENT_NOT_FOUND,
  methodNotAllowed: CLIENT_METHOD_NOT_ALLOWED,
  notAcceptable: CLIENT_NOT_ACCEPTABLE,
  conflict: CLIENT_CONFLICT,
  gone: CLIENT_GONE,
  preconditionFailed: CLIENT_PRECONDITION_FAILED,
  requestEntityTooLarge: CLIENT_REQUEST_ENTITY_TOO_LARGE,
  requestUriTooLong: CLIENT_REQUEST_URI_TOO_LONG,
  unsupportedMediaType: CLIENT_UNSUPPORTED_MEDIA_TYPE,
  imATeapot: CLIENT_IM_ATEAPOT,
  unprocessableEntity: CLIENT_UNPROCESSABLE_ENTITY,
};

export const cacheScopes = {
  none: CACHE_NONE,
  perSession: CACHE_PER_SESSION,
  perUser: CACHE_PER_USER,
  perAppVersion: CACHE_PER_APP_VERSION,
};

export function normalizePath(path) {
  return String(path ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function readData(data) {
  if (!data) {
    return "";
  }
  if (data instanceof Uint8Array) {
    return decoder.decode(data);
  }
  if (data instanceof ArrayBuffer) {
    return decoder.decode(new Uint8Array(data));
  }
  return decoder.decode(data.toUint8Array());
}

export function etag(value) {
  return toETag(value);
}

export function cookie(name, value, options = {}) {
  const expires =
    options.expires instanceof Date
      ? { absolute: BigInt(Math.floor(options.expires.getTime() / 1000)) }
      : options.maxAgeSeconds === undefined
        ? { relative: BigInt(3600) }
        : { relative: BigInt(options.maxAgeSeconds) };

  return {
    name,
    value,
    path: options.path ?? "/",
    domain: options.domain,
    httpOnly: options.httpOnly ?? true,
    secure: options.secure ?? false,
    expires,
  };
}

export function cachePolicy(scope = "none", options = {}) {
  return {
    withCheck: scopeToValue(scope),
    permanent: scopeToValue(options.permanent),
    variesOnCookie: options.variesOnCookie ?? false,
    variesOnAccept: options.variesOnAccept ?? false,
  };
}

export function html(body, options = {}) {
  return content(body, options, "text/html; charset=utf-8");
}

export function json(value, options = {}) {
  const body =
    typeof value === "string"
      ? value
      : JSON.stringify(value, null, options.pretty === true ? 2 : 0);
  return content(body, options, "application/json; charset=utf-8");
}

export function text(body, options = {}) {
  return content(body, options, "text/plain; charset=utf-8");
}

export function download(body, filename, options = {}) {
  return content(body, options, undefined, filename);
}

export function content(
  body,
  options = {},
  defaultMimeType,
  defaultDownload,
) {
  const contentResponse = {
    statusCode: options.statusCode ?? SUCCESS_OK,
    mimeType: options.mimeType ?? defaultMimeType ?? "application/octet-stream",
    encoding: options.encoding,
    language: options.language,
    body: options.ignoreBody === true ? undefined : { bytes: toBytes(body) },
    disposition: options.download || defaultDownload
      ? { download: options.download ?? defaultDownload }
      : { normal: true },
  };
  if (options.etag) {
    contentResponse.eTag = toETag(options.etag);
  }
  return withResponseOptions({ content: contentResponse }, options);
}

export function noContent(options = {}) {
  const response = {
    shouldResetForm: options.shouldResetForm ?? false,
  };
  if (options.etag) {
    response.eTag = toETag(options.etag);
  }
  return withResponseOptions({ noContent: response }, options);
}

export function redirect(location, options = {}) {
  return withResponseOptions(
    {
      redirect: {
        location,
        isPermanent: options.permanent ?? false,
        switchToGet: options.switchToGet ?? true,
      },
    },
    options,
  );
}

export function clientError(statusCode, message, options = {}) {
  const code =
    typeof statusCode === "number"
      ? statusCode
      : (clientErrors[statusCode] ?? CLIENT_BAD_REQUEST);
  const error = {
    statusCode: code,
    descriptionHtml:
      options.descriptionHtml ??
      `<!doctype html><title>Error</title><p>${escapeHtml(message)}</p>`,
  };
  if (options.body) {
    error.nonHtmlBody = {
      data: toBytes(options.body),
      mimeType: options.mimeType ?? "text/plain; charset=utf-8",
      encoding: options.encoding,
      language: options.language,
    };
  }
  return withResponseOptions({ clientError: error }, options);
}

export function serverError(message = "Internal server error.", options = {}) {
  return withResponseOptions(
    {
      serverError: {
        descriptionHtml:
          options.descriptionHtml ??
          `<!doctype html><title>Error</title><p>${escapeHtml(message)}</p>`,
      },
    },
    options,
  );
}

export function methodNotAllowed(message = "Method not allowed.") {
  return clientError(CLIENT_METHOD_NOT_ALLOWED, message);
}

export function preconditionFailed(matchingETag) {
  return {
    preconditionFailed: matchingETag
      ? { matchingETag: toETag(matchingETag) }
      : {},
  };
}

export class WebRequest {
  constructor(method, params, sessionParams) {
    this.method = method;
    this.params = params;
    this.raw = params;
    this.rawSessionParams = sessionParams;
    this.rawPath = params?.path ?? "";
    this.path = normalizePath(this.rawPath);
    this.ignoreBody = Boolean(params?.ignoreBody);
    this.context = has(params, "Context") ? params.context : undefined;
    this._session = undefined;
    this._headers = undefined;
    this._cookies = undefined;
    this._accept = undefined;
    this._acceptEncoding = undefined;
  }

  get session() {
    return (this._session ??= {
      basePath: has(this.rawSessionParams, "BasePath")
        ? this.rawSessionParams.basePath
        : "",
      userAgent: this.rawSessionParams?.userAgent ?? "",
      acceptableLanguages: has(this.rawSessionParams, "AcceptableLanguages")
        ? toArray(this.rawSessionParams.acceptableLanguages)
        : [],
    });
  }

  get headers() {
    return (this._headers ??= pairsToObject(
      has(this.context, "AdditionalHeaders")
        ? this.context.additionalHeaders
        : undefined,
      "name",
      "value",
    ));
  }

  get cookies() {
    return (this._cookies ??= pairsToObject(
      has(this.context, "Cookies") ? this.context.cookies : undefined,
    ));
  }

  get accept() {
    if (this._accept !== undefined) {
      return this._accept;
    }
    const values = toArray(
      has(this.context, "Accept") ? this.context.accept : undefined,
    );
    const result = new Array(values.length);
    for (let index = 0; index < values.length; index++) {
      const item = values[index];
      result[index] = {
        mimeType: item.mimeType,
        qValue: item.qValue,
      };
    }
    this._accept = result;
    return result;
  }

  get acceptEncoding() {
    if (this._acceptEncoding !== undefined) {
      return this._acceptEncoding;
    }
    const values = toArray(
      has(this.context, "AcceptEncoding")
        ? this.context.acceptEncoding
        : undefined,
    );
    const result = new Array(values.length);
    for (let index = 0; index < values.length; index++) {
      const item = values[index];
      result[index] = {
        contentCoding: item.contentCoding,
        qValue: item.qValue,
      };
    }
    this._acceptEncoding = result;
    return result;
  }

  get content() {
    return has(this.params, "Content") ? this.params.content : undefined;
  }

  get hasBody() {
    return has(this.params, "Content") && has(this.params.content, "Content");
  }

  bytes() {
    if (!this.hasBody) {
      return new Uint8Array();
    }
    return this.content.content.toUint8Array();
  }

  text() {
    return decoder.decode(this.bytes());
  }

  json() {
    return JSON.parse(this.text());
  }

  formData() {
    return new URLSearchParams(this.text());
  }

  accepts(mimeType) {
    return this.accept.some(
      (item) => item.mimeType === mimeType || item.mimeType === "*/*",
    );
  }

  matchesNoneOf(value) {
    return matchesNoneOf(this.context, value);
  }
}

export function normalizeWebRequest(method, params, sessionParams) {
  return new WebRequest(method, params, sessionParams);
}

export function matchesNoneOf(context, value) {
  if (!context) {
    return false;
  }
  const precondition = context.eTagPrecondition;
  if (!precondition?._isMatchesNoneOf) {
    return false;
  }
  const tagValue = toETag(value).value;
  const tags = toArray(precondition.matchesNoneOf);
  for (let index = 0; index < tags.length; index++) {
    if (tags[index].value === tagValue) {
      return true;
    }
  }
  return false;
}

export function createWebSession(handlers = {}, options = {}) {
  const handle = (method) => (params) => {
    const handler = handlers[method];
    if (!handler) {
      return methodNotAllowed();
    }
    return handler(normalizeWebRequest(method, params, options.sessionParams), params);
  };

  return {
    get: handle("get"),
    post: handle("post"),
    put: handle("put"),
    delete: handle("delete"),
    patch: handle("patch"),
    propfind: handle("propfind"),
    proppatch: handle("proppatch"),
    mkcol: handle("mkcol"),
    copy: handle("copy"),
    move: handle("move"),
    lock: handle("lock"),
    unlock: handle("unlock"),
    acl: handle("acl"),
    report: handle("report"),
    options: handlers.options
      ? handle("options")
      : () => ({
          davClass1: false,
          davClass2: false,
          davClass3: false,
          davExtensions: [],
        }),
    openWebSocket: handlers.openWebSocket
      ? handle("openWebSocket")
      : () => unsupported("WebSocket support is not implemented"),
    postStreaming: handlers.postStreaming
      ? handle("postStreaming")
      : () => unsupported("Streaming POST support is not implemented"),
    putStreaming: handlers.putStreaming
      ? handle("putStreaming")
      : () => unsupported("Streaming PUT support is not implemented"),
  };
}

async function unsupported(message) {
  const { CapnpRpcError } = await import("@mnutt/capnp-es");
  throw new CapnpRpcError(message, { code: "unimplemented" });
}

function withResponseOptions(response, options) {
  if (options.cache || options.cacheScope) {
    response.cachePolicy =
      typeof options.cache === "object"
        ? cachePolicy(options.cache.scope, options.cache)
        : cachePolicy(options.cacheScope ?? options.cache);
  }
  if (options.headers) {
    response.additionalHeaders = headersToList(options.headers);
  }
  if (options.cookies) {
    response.setCookies = cookiesToList(options.cookies);
  }
  return response;
}

function toBytes(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return encoder.encode(String(value ?? ""));
}

function toCookie(value) {
  if (typeof value?.name === "string" && value.expires === undefined) {
    return cookie(value.name, value.value ?? "", value);
  }
  return value;
}

function toETag(value) {
  if (typeof value === "object" && value !== null && "value" in value) {
    return { value: String(value.value), weak: Boolean(value.weak) };
  }
  return { value: String(value), weak: false };
}

function scopeToValue(value) {
  if (typeof value === "number") {
    return value;
  }
  return cacheScopes[value] ?? CACHE_NONE;
}

function toArray(list) {
  return list?.toArray ? list.toArray() : [];
}

function pairsToObject(list, keyField = "key", valueField = "value") {
  const result = {};
  for (const pair of toArray(list)) {
    result[pair[keyField]] = pair[valueField];
  }
  return result;
}

function headersToList(headers) {
  const names = Object.keys(headers);
  const result = new Array(names.length);
  for (let index = 0; index < names.length; index++) {
    const name = names[index];
    result[index] = {
      name: name.toLowerCase(),
      value: String(headers[name]),
    };
  }
  return result;
}

function cookiesToList(cookies) {
  const result = new Array(cookies.length);
  for (let index = 0; index < cookies.length; index++) {
    result[index] = toCookie(cookies[index]);
  }
  return result;
}

function has(value, suffix) {
  return Boolean(value?.[`_has${suffix}`]?.());
}
