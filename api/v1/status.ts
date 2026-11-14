import { handleStatus } from "../../src/server/api.ts";
import { createApiDeps } from "../../src/server/deps.ts";

const deps = createApiDeps(process.env);

/** GET /api/v1/status — checks a module key and where a day's report stands. */
export default {
  fetch: (request: Request): Promise<Response> => handleStatus(request, deps),
};
