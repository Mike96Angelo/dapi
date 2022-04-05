import { ConnInfo } from "https://deno.land/std@0.133.0/http/server.ts";

// deno-lint-ignore no-explicit-any
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void ? I
  : never;

export interface RequestContext {
  connInfo: ConnInfo;
  params: Record<string, string>;
  path: string;
}

export type RequestHandler<Context = RequestContext> = (
  request: Request,
  context: RequestContext & Context,
) => Promise<Response> | Response;

export type RequestMiddleware<Context = RequestContext> = (
  request: Request,
  context: RequestContext & Context,
  next: () => Promise<Response> | Response,
) => Promise<Response> | Response;

export type RequestMiddlewareContext<A> = A extends RequestMiddleware<infer U>[]
  ? UnionToIntersection<U>
  : A extends RequestMiddleware<infer U> ? U
  : never;

export type HTTPMethods =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export interface RegisterRequestHandler {
  (path: string, handler: RequestHandler): void;
  // deno-lint-ignore no-explicit-any
  <M extends RequestMiddleware<any>[]>(
    path: string,
    middlewares: M,
    handler: RequestHandler<RequestMiddlewareContext<M>>,
  ): void;
}
