import { handleReleves } from "../../src/server/api.ts";
import { createApiDeps } from "../../src/server/deps.ts";

const deps = createApiDeps(process.env);

/** POST /api/v1/releves — the in-game module drops the day's report, pending review. */
export default {
  fetch: (request: Request): Promise<Response> => handleReleves(request, deps),
};
