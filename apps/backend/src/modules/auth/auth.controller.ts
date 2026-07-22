import {
  Controller,
  Post,
  Body,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ResolveIdentifierDto } from './dto/resolve-identifier.dto';
import { DRIZZLE } from '../../db/drizzle.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  @Post('resolve-identifier')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resolveIdentifier(@Body() dto: ResolveIdentifierDto) {
    const identifier = dto.identifier ? dto.identifier.trim() : '';

    // Kalau sudah berbentuk email, langsung kembalikan apa adanya
    if (identifier.includes('@')) {
      return { email: identifier };
    }

    const [foundUser] = await this.db
      .select({ email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.username, identifier));

    if (!foundUser) {
      throw new NotFoundException('Username tidak ditemukan');
    }

    return { email: foundUser.email };
  }
}
