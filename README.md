# Dapi HTTP Router

A Simple HTTP Router with middleware for Deno.

[Documentation](docs.md)

Example:

```ts
// server.ts

import { serve } from "https://deno.land/std/http/server.ts";
import { Router } from "https://deno.land/x/dapi/mod.ts";

const router = new Router();

router.get("/", (request, context) => {
  return new Response("Hello, World!");
});

await serve(router.handler, { port: 8888 });
```
