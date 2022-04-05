import { serve } from "https://deno.land/std@0.133.0/http/server.ts";
import { format } from "https://deno.land/std@0.133.0/datetime/mod.ts";
import { composeMiddleware, RequestMiddleware, Router } from "../mod.ts";

interface AuthContext {
  user: { id: string; name: string };
}

const log: RequestMiddleware = async (request, _context, next) => {
  const url = new URL(request.url);
  const start = new Date();
  console.log(
    `${
      format(start, "yyyy-MM-dd HH:mm:ss")
    } -> ${request.method} ${url.pathname}`,
  );
  const response = await next();
  const end = new Date();
  console.log(
    `${
      format(start, "yyyy-MM-dd HH:mm:ss")
    } <- ${request.method} ${url.pathname} ${response.status} in ${
      end.valueOf() - start.valueOf()
    }ms`,
  );

  return response;
};

const auth: RequestMiddleware<Partial<AuthContext>> = (
  _request,
  context,
  next,
) => {
  context.user = { id: "1009", name: "John Doe" }; // get user from auth tokens

  return next();
};

const requireAuth_: RequestMiddleware<AuthContext> = (
  _request,
  context,
  next,
) => {
  if (context.user == null) {
    return new Response("Unauthorized", { status: 401 });
  }

  return next();
};

const requireAuth = composeMiddleware([auth, requireAuth_]);

const router = new Router();

router.get("/*", [log, auth], (_, context) => {
  return new Response(JSON.stringify(context), { status: 404 });
});

router.get("/", [log, auth], (_, context) => {
  return new Response(JSON.stringify(context), {
    headers: { "content-type": "application/json" },
  });
});

const apiV1Router = new Router();

apiV1Router.get("users", [log, requireAuth], (_, context) => {
  return new Response(JSON.stringify(context));
});

router.route("/api/v1", apiV1Router);

await serve(router.handler, { port: 8888 });
