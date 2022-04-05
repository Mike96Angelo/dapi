import { Handler } from "https://deno.land/std@0.133.0/http/server.ts";
import { withMiddleware } from "./composeMiddleware.ts";
import {
  HTTPMethods,
  RegisterRequestHandler,
  RequestContext,
  RequestHandler,
  RequestMiddleware,
} from "./types.ts";
interface Route {
  method: HTTPMethods;
  path: string;
  handler: RequestHandler;
}

interface ParamHandlers {
  param: string;
  handlers: Handlers;
}

interface MethodHandlers {
  uri: string;
  methodHandlers: Partial<Record<HTTPMethods, RequestHandler>>;
}

interface Handlers {
  uri: string;
  level: number;
  parent?: Handlers;
  handlers?: MethodHandlers;
  static: Record<string, Handlers>;
  param?: ParamHandlers;
  glob?: MethodHandlers;
  // deno-lint-ignore no-explicit-any
  toJSON: () => any;
}

const createHandlers = (uri: string, parent?: Handlers): Handlers => ({
  level: (parent?.level ?? -1) + 1,
  uri,
  parent,
  static: {},
  toJSON() {
    const { parent: _, ...rest } = this;
    return rest;
  },
});

const createMethodHandlers = (uri: string): MethodHandlers => ({
  uri,
  methodHandlers: {},
});

const handleNotFound: RequestHandler = () =>
  new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });

export class Router {
  #routes: Route[] = [];
  #handlers = createHandlers("/");

  #registerHandler = (
    method: HTTPMethods,
    path: string,
    handler: RequestHandler,
  ) => {
    const normalizedPath = path.replace(/\/+/g, "/").replace(/\/$/, "");

    this.#routes.push({ method, path: normalizedPath, handler });

    const uriParts = normalizedPath.replace(/^\//, "").split("/");

    const params = new Set<string>();
    let glob = false;
    let currentHandlers = this.#handlers;
    let uri = "";
    for (const part of uriParts) {
      uri += `/${part}`;
      if (part.startsWith("*")) {
        glob = true;
        break;
      } else if (part.startsWith(":")) {
        const param = part.slice(1);
        if (params.has(param)) {
          throw new Error(
            `Cannot specify param ${part} multiple times in URI: ${normalizedPath}`,
          );
        }
        if (param === "path") {
          throw new Error(`Param ${part} is reserved for glob match`);
        }

        if (currentHandlers.glob?.methodHandlers[method]) {
          throw new Error(
            `Cannot specify both param and glob at ${method} /${
              uriParts
                .slice(0, currentHandlers.level)
                .join("/")
            }/?`,
          );
        }

        currentHandlers.param = currentHandlers.param ?? {
          param,
          handlers: createHandlers(uri, currentHandlers),
        };

        if (currentHandlers.param.param !== param) {
          throw new Error(
            `Cannot specify multiple params (:${currentHandlers.param.param}, :${param}) at same URI location`,
          );
        }
        params.add(param);

        currentHandlers = currentHandlers.param.handlers;
      } else {
        currentHandlers.static[part] = currentHandlers.static[part] ??
          createHandlers(uri, currentHandlers);
        currentHandlers = currentHandlers.static[part];
      }
    }

    if (glob) {
      if (currentHandlers.handlers?.methodHandlers[method]) {
        throw new Error(
          `Cannot specify both param and glob at ${method} /${
            uriParts
              .slice(0, currentHandlers.level)
              .join("/")
          }/?`,
        );
      }
      currentHandlers.glob = currentHandlers.glob ??
        createMethodHandlers(normalizedPath);
      if (currentHandlers.glob.methodHandlers[method]) {
        throw new Error(
          `Cannot specify multiple handlers for ${method}: ${normalizedPath}`,
        );
      }

      currentHandlers.glob.methodHandlers[method] = handler;
    } else {
      currentHandlers.handlers = currentHandlers.handlers ??
        createMethodHandlers(normalizedPath);
      if (currentHandlers.handlers.methodHandlers[method]) {
        throw new Error(
          `Cannot specify multiple handlers for ${method}: ${normalizedPath}`,
        );
      }

      currentHandlers.handlers.methodHandlers[method] = handler;
    }
  };

  handler: Handler = (request, connInfo) => {
    const context: RequestContext = { connInfo, params: {}, path: "" };
    const url = new URL(request.url);
    const method = request.method as HTTPMethods;

    const urlParts = url.pathname
      .replace(/\/+/g, "/")
      .replace(/^\//, "")
      .replace(/\/$/, "")
      .split("/");
    let glob = false;
    let currentHandlers = this.#handlers;
    for (const part of urlParts) {
      if (currentHandlers.static[part]) {
        currentHandlers = currentHandlers.static[part];
      } else if (currentHandlers.param) {
        context.params[currentHandlers.param.param] = part;

        currentHandlers = currentHandlers.param.handlers;
      } else {
        glob = true;
        break;
      }
    }

    if (
      !glob &&
      currentHandlers.handlers?.methodHandlers[method] == null &&
      currentHandlers.parent
    ) {
      glob = true;
      currentHandlers = currentHandlers.parent;
    }

    if (glob) {
      while (
        currentHandlers.glob?.methodHandlers[method] == null &&
        currentHandlers.parent
      ) {
        currentHandlers = currentHandlers.parent;
      }

      const handler = currentHandlers.glob?.methodHandlers[method] ??
        handleNotFound;

      context.path = currentHandlers.glob?.uri ?? "/*";

      context.params.path = urlParts.slice(currentHandlers.level).join("/");

      return handler(request, context);
    }

    const handler = currentHandlers.handlers?.methodHandlers[method] ??
      handleNotFound;

    context.path = currentHandlers.handlers?.uri ?? "/*";
    return handler(request, context);
  };

  #createRegisterRequestHandler = (
    method: HTTPMethods,
  ): RegisterRequestHandler =>
    ((
      path: string,
      middleware_: RequestMiddleware[] | RequestHandler,
      handler_?: RequestHandler,
    ) => {
      const middleware = handler_ ? (middleware_ as RequestMiddleware[]) : [];
      const handler = handler_ ?? (middleware_ as RequestHandler);

      this.#registerHandler(method, path, withMiddleware(middleware, handler));
    }) as RegisterRequestHandler;

  get = this.#createRegisterRequestHandler("GET");
  post = this.#createRegisterRequestHandler("POST");
  put = this.#createRegisterRequestHandler("PUT");
  delete = this.#createRegisterRequestHandler("DELETE");
  patch = this.#createRegisterRequestHandler("PATCH");
  head = this.#createRegisterRequestHandler("HEAD");
  options = this.#createRegisterRequestHandler("OPTIONS");

  route(path: string, router: Router) {
    for (const route of router.#routes) {
      this.#registerHandler(
        route.method,
        [path, route.path].join("/"),
        route.handler,
      );
    }
  }
}
