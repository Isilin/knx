import { createAccountDeps } from "../../src/server/accountDeps.ts";
import { handleAccounts } from "../../src/server/accounts.ts";

const deps = createAccountDeps(process.env);

/** POST /api/v1/comptes — an operator creates a player's account or resets its password. */
export default {
  fetch: (request: Request): Promise<Response> => handleAccounts(request, deps),
};
