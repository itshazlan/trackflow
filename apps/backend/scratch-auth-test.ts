import 'dotenv/config';
import { auth } from './src/modules/auth/better-auth.config';

async function main() {
  const token = '756XO85uGUH6LbW0L4H5NB1z0kjEO68A'; // Hamzah Alvana active token

  // Test with better-auth.session_token
  const headers1 = new Headers();
  headers1.set('cookie', `better-auth.session_token=${token}`);
  const session1 = await auth.api.getSession({ headers: headers1 });
  console.log('Test 1 (underscore cookie) session:', session1);

  // Test with better-auth.session-token
  const headers2 = new Headers();
  headers2.set('cookie', `better-auth.session-token=${token}`);
  const session2 = await auth.api.getSession({ headers: headers2 });
  console.log('Test 2 (hyphen cookie) session:', session2);

  // Test with Bearer token
  const headers3 = new Headers();
  headers3.set('authorization', `Bearer ${token}`);
  const session3 = await auth.api.getSession({ headers: headers3 });
  console.log('Test 3 (Bearer token) session:', session3);
}

main().catch(console.error);
