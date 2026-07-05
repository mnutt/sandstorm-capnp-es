import type { Conn } from "@mnutt/capnp-es";
import type {
  MainView$Server$Target,
  UiView_NewSession$Params,
  UiView_ViewInfo,
} from "./sandstorm/grain.js";
import type { WebSessionHandlers } from "./web.js";

export type MainViewOptions = {
  viewInfo?: Partial<UiView_ViewInfo> | Record<string, unknown>;
  getViewInfo?: () => Partial<UiView_ViewInfo> | Promise<Partial<UiView_ViewInfo>>;
  webSession?:
    | Record<string, unknown>
    | ((params: UiView_NewSession$Params) => Record<string, unknown>);
  createSession?: (params: UiView_NewSession$Params) => unknown | Promise<unknown>;
  restore?: (params: unknown, results: unknown) => unknown | Promise<unknown>;
  drop?: (params: unknown, results: unknown) => unknown | Promise<unknown>;
};

export type ServeSandstormAppOptions = MainViewOptions & {
  fd?: number;
  conn?: {
    initMain(schema: unknown, target: unknown): void;
    bootstrap?(schema: unknown): unknown;
    onError?: (error: unknown) => void;
    sandstormApi?: unknown;
  };
  connect?: Record<string, unknown>;
  mainView?: MainView$Server$Target | MainViewOptions;
  onError?: (error: unknown) => void;
  bootstrapSandstormApi?: boolean;
  onBootstrapError?: (error: unknown) => void;
};

export function isWebSession(params: { sessionType?: bigint } | undefined): boolean;
export function webSession(
  handlers: WebSessionHandlers,
  options?: { sessionParams?: unknown },
): (params: UiView_NewSession$Params) => Record<string, unknown>;
export function mainView(options?: MainViewOptions): MainView$Server$Target;
export function serveSandstormApp(
  options?: ServeSandstormAppOptions,
): Promise<Conn & { sandstormApi?: unknown }>;
