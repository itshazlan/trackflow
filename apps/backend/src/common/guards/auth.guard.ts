import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { auth } from '../../modules/auth/better-auth.config';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    try {
      // Better Auth expects a standard Headers object
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value as string);
          }
        }
      }

      const session = await auth.api.getSession({
        headers,
      });

      if (!session) {
        throw new UnauthorizedException('Session invalid or expired');
      }

      request.user = session.user;
      request.session = session.session;
      return true;
    } catch (err: any) {
      console.error('[AuthGuard Error]:', err);
      throw new UnauthorizedException(err.message || 'Authentication failed');
    }
  }
}
