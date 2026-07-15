import { Controller, Get, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import * as express from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('desktop-updater/:target/:version')
  getUpdateManifest(
    @Param('target') target: string,
    @Param('version') version: string,
    @Res() res: express.Response,
  ) {
    console.log(`[Updater] Checked update for Target: ${target}, Version: ${version}`);
    // Return 240 No Content to signify that the client version is up to date.
    return res.status(204).send();
  }
}
