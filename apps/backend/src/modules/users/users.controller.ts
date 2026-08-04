import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/user-profile.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.findOne(req.user.id);
  }

  @Get()
  listAll() {
    return this.usersService.findAll();
  }

  @Patch('me')
  updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  /**
   * POST /api/users/me/avatar
   * Generates a pre-signed upload URL for avatar photo.
   */
  @Post('me/avatar')
  getAvatarUploadUrl(@Req() req: any) {
    return this.usersService.getAvatarUploadUrl(req.user.id);
  }
}
