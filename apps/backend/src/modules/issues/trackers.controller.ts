import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TrackersService } from './trackers.service';
import { CreateTrackerDto } from './dto/tracker.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('trackers')
@UseGuards(AuthGuard)
export class TrackersController {
  constructor(private readonly trackersService: TrackersService) {}

  @Get()
  findAll() {
    return this.trackersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trackersService.findOne(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() createTrackerDto: CreateTrackerDto) {
    return this.trackersService.create(createTrackerDto);
  }
}
