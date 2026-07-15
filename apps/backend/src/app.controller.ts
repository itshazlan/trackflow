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

  @Get('desktop-updater/download/appsdesktop.app.tar.gz')
  downloadUpdate(@Res() res: express.Response) {
    const filePath = '/Users/itshazlan/Developer/Personal/Backend/trackflow/apps/desktop/src-tauri/target/release/bundle/macos/appsdesktop.app.tar.gz';
    console.log(`[Updater] Streaming update file: ${filePath}`);
    return res.sendFile(filePath);
  }

  @Get('desktop-updater/:target/:version')
  getUpdateManifest(
    @Param('target') target: string,
    @Param('version') version: string,
    @Res() res: express.Response,
  ) {
    console.log(`[Updater] Checked update for Target: ${target}, Version: ${version}`);
    
    if (version === '0.1.0') {
      console.log(`[Updater] Client version is 0.1.0. Offering 0.2.0 update!`);
      const manifest = {
        version: '0.2.0',
        notes: 'TrackFlow Desktop v0.2.0 - Slicing Auto-Update Selesai!',
        pub_date: new Date().toISOString(),
        platforms: {
          'darwin-aarch64': {
            signature: 'dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRVm9kQ0RMVlh4cEZOMDBWNXlQQ0k0a09ZNnBKMHhqRVBRL2pQY2RZYllzRzVBbER6RUNsVXJXbEU2ZWVoRGpMY2lBaDN6SWVaZi9kWFVVdG1pT29IUHQ4aCszdHJlQWdnPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzg0MTMwNDIyCWZpbGU6YXBwc2Rlc2t0b3AuYXBwLnRhci5negoyWTVpODA0RytTaW1jL1ZJcWtPcTUrYk92TStZUWgxZnJGZzk3bXliVy9tZkxmQTQwMVdNSmtNd3BsZXd1SE4rVThFNjNCcGVKWWtmT0lhV05Tc09CUT09Cg==',
            url: 'http://localhost:3000/desktop-updater/download/appsdesktop.app.tar.gz'
          },
          'darwin-aarch64-app': {
            signature: 'dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRVm9kQ0RMVlh4cEZOMDBWNXlQQ0k0a09ZNnBKMHhqRVBRL2pQY2RZYllzRzVBbER6RUNsVXJXbEU2ZWVoRGpMY2lBaDN6SWVaZi9kWFVVdG1pT29IUHQ4aCszdHJlQWdnPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzg0MTMwNDIyCWZpbGU6YXBwc2Rlc2t0b3AuYXBwLnRhci5negoyWTVpODA0RytTaW1jL1ZJcWtPcTUrYk92TStZUWgxZnJGZzk3bXliVy9tZkxmQTQwMVdNSmtNd3BsZXd1SE4rVThFNjNCcGVKWWtmT0lhV05Tc09CUT09Cg==',
            url: 'http://localhost:3000/desktop-updater/download/appsdesktop.app.tar.gz'
          },
          'darwin-x86_64': {
            signature: 'dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRVm9kQ0RMVlh4cEZOMDBWNXlQQ0k0a09ZNnBKMHhqRVBRL2pQY2RZYllzRzVBbER6RUNsVXJXbEU2ZWVoRGpMY2lBaDN6SWVaZi9kWFVVdG1pT29IUHQ4aCszdHJlQWdnPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzg0MTMwNDIyCWZpbGU6YXBwc2Rlc2t0b3AuYXBwLnRhci5negoyWTVpODA0RytTaW1jL1ZJcWtPcTUrYk92TStZUWgxZnJGZzk3bXliVy9tZkxmQTQwMVdNSmtNd3BsZXd1SE4rVThFNjNCcGVKWWtmT0lhV05Tc09CUT09Cg==',
            url: 'http://localhost:3000/desktop-updater/download/appsdesktop.app.tar.gz'
          },
          'darwin-x86_64-app': {
            signature: 'dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRVm9kQ0RMVlh4cEZOMDBWNXlQQ0k0a09ZNnBKMHhqRVBRL2pQY2RZYllzRzVBbER6RUNsVXJXbEU2ZWVoRGpMY2lBaDN6SWVaZi9kWFVVdG1pT29IUHQ4aCszdHJlQWdnPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzg0MTMwNDIyCWZpbGU6YXBwc2Rlc2t0b3AuYXBwLnRhci5negoyWTVpODA0RytTaW1jL1ZJcWtPcTUrYk92TStZUWgxZnJGZzk3bXliVy9tZkxmQTQwMVdNSmtNd3BsZXd1SE4rVThFNjNCcGVKWWtmT0lhV05Tc09CUT09Cg==',
            url: 'http://localhost:3000/desktop-updater/download/appsdesktop.app.tar.gz'
          },
          'windows-x86_64': {
            signature: 'dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRVm9kQ0RMVlh4cEZOMDBWNXlQQ0k0a09ZNnBKMHhqRVBRL2pQY2RZYllzRzVBbER6RUNsVXJXbEU2ZWVoRGpMY2lBaDN6SWVaZi9kWFVVdG1pT29IUHQ4aCszdHJlQWdnPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzg0MTMwNDIyCWZpbGU6YXBwc2Rlc2t0b3AuYXBwLnRhci5negoyWTVpODA0RytTaW1jL1ZJcWtPcTUrYk92TStZUWgxZnJGZzk3bXliVy9tZkxmQTQwMVdNSmtNd3BsZXd1SE4rVThFNjNCcGVKWWtmT0lhV05Tc09CUT09Cg==',
            url: 'http://localhost:3000/desktop-updater/download/appsdesktop.app.tar.gz'
          }
        }
      };
      return res.status(200).json(manifest);
    }

    // Return 204 No Content to signify that the client version is up to date.
    return res.status(204).send();
  }
}
