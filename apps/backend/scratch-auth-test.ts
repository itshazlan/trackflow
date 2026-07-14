import 'dotenv/config';
import { auth } from './src/modules/auth/better-auth.config';

async function main() {
  const token = 'MwpIVqSsoMZBb8O2f48uZZAsKqe3CSrK'; // Hamzah Alvana

  // Test with better-auth.session_token
  const headers1 = new Headers();
  headers1.set('cookie', `better-auth.session_token=${token}`);
  const session1 = await auth.api.getSession({ headers: headers1 });
  console.log('Test 1 (underscore) session:', session1);

  // Test with better-auth.session-token
  const headers2 = new Headers();
  headers2.set('cookie', `better-auth.session-token=${token}`);
  const session2 = await auth.api.getSession({ headers: headers2 });
  console.log('Test 2 (hyphen) session:', session2);
}

main().catch(console.error);
