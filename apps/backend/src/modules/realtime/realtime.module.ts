import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from '../../gateways/realtime.gateway';
import { DbModule } from '../../db/db.module';

@Global()
@Module({
  imports: [DbModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
