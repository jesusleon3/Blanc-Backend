import { Global, Module } from '@nestjs/common';
import { AUDITORIA_PORT } from './auditoria.port';
import { DrizzleAuditoriaRepository } from './drizzle-auditoria.repository';

@Global()
@Module({
  providers: [{ provide: AUDITORIA_PORT, useClass: DrizzleAuditoriaRepository }],
  exports: [AUDITORIA_PORT],
})
export class AuditoriaModule {}
