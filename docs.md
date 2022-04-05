# Dapi Documentation

A Simple HTTP Router with middleware for Deno.

- [Router](#router)
  - [Route Matching Order](#route-matching-order)
  - [Router.handler](#routerhandler)
  - [Router.\<methods\>()](#routermethods)
  - [Router.route()](#routerroute)
- [RequestContext](#requestcontext)
- [RequestHandler](#requesthandler)
- [RequestMiddleware](#requestmiddleware)
- [composeMiddleware](#composemiddleware)

## Router

Allow you to route requests based on method and url path matching.

Example:

```ts
// router.ts

import { Router } from "https://deno.land/x/dapi/mod.ts";

const router = new Router();

export { router };
```

### Route Matching Order:

1. static -- static paths (e.g. /api/v1/users)
1. params -- params paths (e.g. /api/v1/users/:userId)
1. glob -- glob (e.g. /assets/*)
1. parent glob -- parent glob (e.g. /*) (recursive)

```
routes:
  /posts/some-post
  /posts/:postId
  /assets/scripts/*
  /assets/*
  /*

path(/posts/some-post)       => route(/posts/some-post)
path(/posts/some-other-post) => route(/posts/:postId)
path(/assets/scripts/app.js) => route(/assets/scripts/*)
path(/assets/image.png)      => route(/assets/*)
path(/assets)                => route(/*)
```

### Router.handler

The handler property can be passed in
[serve or serveTls](https://deno.land/std/http/server.ts).

Example:

```ts
// server.ts

import { serve } from "https://deno.land/std/http/server.ts";
import { router } from "./router.ts";

await serve(router.handler, { port: 8000 });
```

```ts
// serverTls.ts

import { serveTls } from "https://deno.land/std/http/server.ts";
import { router } from "./router.ts";

await serveTls(router.handler, {
  port: 8888,
  certFile: "cert.pem",
  keyFile: "key.pem",
});
```

### Router.\<methods>()

Allows you to add a [RequestHandler](#requesthandler) with optional
[RequestMiddleware](#requestmiddleware) for a particular path and http method.

```ts
Router.get(path: string, handler: RequestHandler)
Router.get(path: string, middleware: RequestMiddle[], handler: RequestHandler)

// likewise for: post, put, patch, delete, head, options
```

Example:

```ts
// router.ts

router.get("/products", async (request, context) => {
  const products = await getProducts();

  return new Response(
    JSON.stringify({ products }),
    { headers: { "content-type": "application/json" } },
  );
});

router.post("/products", [validateBody], async (request, context) => {
  const product = await request.json();
  const addedProduct = await addProduct(product);

  return new Response(
    JSON.stringify({ product: addedProduct }),
    {
      status: 201,
      headers: { "content-type": "application/json" },
    },
  );
});

router.get("/products/:productId", async (request, context) => {
  const products = await getProductsById(context.params.productId);

  return new Response(
    JSON.stringify({ products }),
    { headers: { "content-type": "application/json" } },
  );
});

router.put("/products/:productId", [validateBody], async (request, context) => {
  const productUpdate = await request.json();
  const updatedProduct = await updateProductById(
    context.params.productId,
    productUpdate,
  );

  return new Response(
    JSON.stringify({ product: updatedProduct }),
    { headers: { "content-type": "application/json" } },
  );
});

router.delete("/products/:productId", async (request, context) => {
  const deletedProduct = await deleteProductById(
    context.params.productId,
    productUpdate,
  );

  return new Response(
    JSON.stringify({ product: deletedProduct }),
    { headers: { "content-type": "application/json" } },
  );
});

// router.patch, router.head, router.options
```

### Router.route()

Allows you to add a sub Router at a given path.

Example:

```ts
// postsRouter.ts

import { Router } from "https://deno.land/x/dapi/mod.ts";

const postsRouter = new Router();

postsRouter.get("", async (request, context) => {
  const posts = await getPosts();

  return new Response(JSON.stringify({ posts }), {
    headers: { "Content-Type": "application/json" },
  });
});

postsRouter.get(":postId", async (request, context) => {
  const post = await getPostsById(context.params.postId);

  return new Response(JSON.stringify({ post }), {
    headers: { "Content-Type": "application/json" },
  });
});

export { postsRouter };
```

```ts
// router.ts

import { postsRouter } from "./postsRouter.ts";

router.route("/api/v1/posts", postsRouter);
```

## RequestContext

```ts
interface RequestContext {
  connInfo: ConnInfo;
  params: Record<string, string>;
  path: string;
}
```

## RequestHandler

```ts
type RequestHandler<Context = RequestContext> = (
  request: Request,
  context: RequestContext & Context,
) => Promise<Response> | Response;
```

## RequestMiddleware

```ts
type RequestMiddleware<Context = RequestContext> = (
  request: Request,
  context: RequestContext & Context,
  next: () => Promise<Response> | Response,
) => Promise<Response> | Response;
```

## composeMiddleware()

Allows you to combine multiple composeMiddleware into one.

Example:

```ts
// authMiddleware.ts

import { composeMiddleware } from "https://deno.land/x/dapi/mod.ts";

interface AuthContext {
  user: { id: string; name: string };
}

const auth: RequestMiddleware<Partial<AuthContext>> = async (
  request,
  context,
  next,
) => {
  context.user = await getUser(request);

  return next();
};

const requireAuth_: RequestMiddleware<AuthContext> = (
  request,
  context,
  next,
) => {
  if (context.user == null) {
    return new Response("Unauthorized", { status: 401 });
  }

  return next();
};

const requireAuth = composeMiddleware([auth, requireAuth_]);

export { auth, requireAuth };
```

```ts
// server.ts

import { requireAuth } from "./authMiddleware.ts";

router.get("/api/v1/me", [requireAuth], (request, context) => {
  return new Response(JSON.stringify({ user: context.user }), {
    headers: { "Content-Type": "application/json" },
  });
});
```
