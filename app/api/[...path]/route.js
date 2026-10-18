import { env } from 'cloudflare:workers';
import { handleApi } from '../../../server/api.js';
import { ownerCanSetupAdmin } from '../../../server/hosting.js';
export const dynamic = 'force-dynamic';
// Public visitors use app accounts. Only the verified Site owner can bootstrap an admin.
const handle = request => handleApi(request, env.DB, {
  allowAdminSignup: ownerCanSetupAdmin(request, env.SMALL_STEPS_OWNER_EMAIL),
  debugAuth: new URL(request.url).hostname === '127.0.0.1',
});
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
