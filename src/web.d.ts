import type {
  WebSession_CachePolicy_Scope,
  WebSession_Context,
  WebSession_Response,
  WebSession_Response_ClientErrorCode,
  WebSession_Response_SuccessCode,
} from "./sandstorm/web-session.js";

export const success: {
  ok: WebSession_Response_SuccessCode;
  created: WebSession_Response_SuccessCode;
  accepted: WebSession_Response_SuccessCode;
  noContent: WebSession_Response_SuccessCode;
  partialContent: WebSession_Response_SuccessCode;
  multiStatus: WebSession_Response_SuccessCode;
  notModified: WebSession_Response_SuccessCode;
};

export const clientErrors: {
  badRequest: WebSession_Response_ClientErrorCode;
  forbidden: WebSession_Response_ClientErrorCode;
  notFound: WebSession_Response_ClientErrorCode;
  methodNotAllowed: WebSession_Response_ClientErrorCode;
  notAcceptable: WebSession_Response_ClientErrorCode;
  conflict: WebSession_Response_ClientErrorCode;
  gone: WebSession_Response_ClientErrorCode;
  preconditionFailed: WebSession_Response_ClientErrorCode;
  requestEntityTooLarge: WebSession_Response_ClientErrorCode;
  requestUriTooLong: WebSession_Response_ClientErrorCode;
  unsupportedMediaType: WebSession_Response_ClientErrorCode;
  imATeapot: WebSession_Response_ClientErrorCode;
  unprocessableEntity: WebSession_Response_ClientErrorCode;
};

export const cacheScopes: {
  none: WebSession_CachePolicy_Scope;
  perSession: WebSession_CachePolicy_Scope;
  perUser: WebSession_CachePolicy_Scope;
  perAppVersion: WebSession_CachePolicy_Scope;
};

export type BodyInput = string | Uint8Array | ArrayBuffer;
export type CacheScope =
  | keyof typeof cacheScopes
  | WebSession_CachePolicy_Scope;
export type ETagInput = string | { value: string; weak?: boolean };

export type CookieOptions = {
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  expires?: Date;
  maxAgeSeconds?: number | bigint;
};

export type CachePolicyOptions = {
  permanent?: CacheScope;
  variesOnCookie?: boolean;
  variesOnAccept?: boolean;
};

export type ResponseOptions = {
  ignoreBody?: boolean;
  statusCode?: WebSession_Response_SuccessCode;
  mimeType?: string;
  encoding?: string;
  language?: string;
  etag?: ETagInput;
  download?: string;
  headers?: Record<string, string | number | boolean>;
  cookies?: Array<{ name: string; value: string } & CookieOptions>;
  cache?: { scope?: CacheScope } & CachePolicyOptions;
  cacheScope?: CacheScope;
};

export type WebResponse = Partial<WebSession_Response> | Record<string, unknown>;

export function normalizePath(path: string): string;
export function escapeHtml(value: unknown): string;
export function readData(
  data: { toUint8Array(): Uint8Array } | Uint8Array | ArrayBuffer | undefined,
): string;
export function etag(value: ETagInput): { value: string; weak: boolean };
export function cookie(
  name: string,
  value: string,
  options?: CookieOptions,
): Record<string, unknown>;
export function cachePolicy(
  scope?: CacheScope,
  options?: CachePolicyOptions,
): Record<string, unknown>;
export function html(body: BodyInput, options?: ResponseOptions): WebResponse;
export function json(
  value: unknown,
  options?: ResponseOptions & { pretty?: boolean },
): WebResponse;
export function text(body: BodyInput, options?: ResponseOptions): WebResponse;
export function download(
  body: BodyInput,
  filename: string,
  options?: ResponseOptions,
): WebResponse;
export function content(body: BodyInput, options?: ResponseOptions): WebResponse;
export function noContent(
  options?: Omit<ResponseOptions, "statusCode" | "mimeType" | "download"> & {
    shouldResetForm?: boolean;
  },
): WebResponse;
export function redirect(
  location: string,
  options?: Omit<ResponseOptions, "statusCode" | "mimeType" | "download"> & {
    permanent?: boolean;
    switchToGet?: boolean;
  },
): WebResponse;
export function clientError(
  statusCode: WebSession_Response_ClientErrorCode | keyof typeof clientErrors,
  message: string,
  options?: ResponseOptions & {
    descriptionHtml?: string;
    body?: BodyInput;
  },
): WebResponse;
export function serverError(message?: string, options?: ResponseOptions): WebResponse;
export function methodNotAllowed(message?: string): WebResponse;
export function preconditionFailed(matchingETag?: ETagInput): WebResponse;

export class WebRequest<RawParams = unknown, SessionParams = unknown> {
  constructor(method: string, params: RawParams, sessionParams?: SessionParams);
  method: string;
  params: RawParams;
  raw: RawParams;
  rawSessionParams?: SessionParams;
  path: string;
  rawPath: string;
  ignoreBody: boolean;
  context?: WebSession_Context;
  readonly session: {
    basePath: string;
    userAgent: string;
    acceptableLanguages: string[];
  };
  readonly headers: Record<string, string>;
  readonly cookies: Record<string, string>;
  readonly accept: Array<{ mimeType: string; qValue: number }>;
  readonly acceptEncoding: Array<{ contentCoding: string; qValue: number }>;
  readonly content: unknown;
  readonly hasBody: boolean;
  bytes(): Uint8Array;
  text(): string;
  json(): unknown;
  formData(): URLSearchParams;
  accepts(mimeType: string): boolean;
  matchesNoneOf(value: ETagInput): boolean;
}

export function normalizeWebRequest<RawParams, SessionParams = unknown>(
  method: string,
  params: RawParams,
  sessionParams?: SessionParams,
): WebRequest<RawParams, SessionParams>;

export type WebSessionHandler = (
  request: WebRequest,
  rawParams: unknown,
) => WebResponse | Promise<WebResponse>;

export type WebSessionHandlers = Partial<
  Record<
    | "get"
    | "post"
    | "put"
    | "delete"
    | "patch"
    | "propfind"
    | "proppatch"
    | "mkcol"
    | "copy"
    | "move"
    | "lock"
    | "unlock"
    | "acl"
    | "report"
    | "options"
    | "openWebSocket"
    | "postStreaming"
    | "putStreaming",
    WebSessionHandler
  >
>;

export function matchesNoneOf(
  context: WebSession_Context | undefined,
  value: ETagInput,
): boolean;
export function createWebSession(
  handlers?: WebSessionHandlers,
  options?: { sessionParams?: unknown },
): Record<string, unknown>;
