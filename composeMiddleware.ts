import {
  RequestHandler,
  RequestMiddleware,
  RequestMiddlewareContext,
} from "./types.ts";

interface ComposeMiddleware {
  // deno-lint-ignore no-explicit-any
  <M extends RequestMiddleware<any>[]>(middleware: M): RequestMiddleware<
    RequestMiddlewareContext<M>
  >;
}

export const composeMiddleware: ComposeMiddleware = (middleware) =>
  (request, context, next) => {
    let index = 0;

    const nextMiddleware = () => {
      const currentMiddleware = middleware[index];
      index++;

      if (currentMiddleware) {
        return currentMiddleware(request, context, nextMiddleware);
      }

      return next();
    };

    return nextMiddleware();
  };

interface WithMiddleware {
  // deno-lint-ignore no-explicit-any
  <M extends RequestMiddleware<any>[]>(
    middleware: M,
    handler: RequestHandler<RequestMiddlewareContext<M>>,
  ): RequestHandler;
}

export const withMiddleware: WithMiddleware = (middleware, handler) =>
  (request, ctx) =>
    // deno-lint-ignore no-explicit-any
    composeMiddleware(middleware)(request, ctx as any, () =>
      // deno-lint-ignore no-explicit-any
      handler(request, ctx as any));
