import 'dotenv/config';
import { auth } from './src/modules/auth/better-auth.config';

async function main() {
  console.log('Current Time:', new Date());

  // Let's sign in a user to see how the session cookie is constructed
  const sessionResult = await auth.api.signInEmail({
    body: {
      email: 'admin@trackflow.com',
      password: 'AdminPassword123!',
    }
  });

  console.log('Sign In Result:', sessionResult);
}

main().catch(console.error);
