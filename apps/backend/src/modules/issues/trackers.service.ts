import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { issueTrackers } from '../../db/schema/issues';
import { CreateTrackerDto } from './dto/tracker.dto';

@Injectable()
export class TrackersService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  async findAll() {
    return this.db.select().from(issueTrackers);
  }

  async findOne(id: string) {
    const [tracker] = await this.db
      .select()
      .from(issueTrackers)
      .where(eq(issueTrackers.id, id))
      .limit(1);

    if (!tracker) {
      throw new NotFoundException(`Tracker with ID ${id} not found`);
    }

    return tracker;
  }

  async create(createTrackerDto: CreateTrackerDto) {
    const [newTracker] = await this.db
      .insert(issueTrackers)
      .values({ name: createTrackerDto.name })
      .returning();
    return newTracker;
  }
}
