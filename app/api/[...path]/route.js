import { env } from 'cloudflare:workers';
import { handleApi } from '../../../server/api.js';
export const dynamic = 'force-dynamic';
// Sites keeps its outer ChatGPT access boundary alongside the requested app login.
const handle = request => handleApi(request, env.DB, {
  allowAdminSignup: Boolean(request.headers.get('oai-authenticated-user-id')),
  debugAuth: new URL(request.url).hostname === '127.0.0.1',
});
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
