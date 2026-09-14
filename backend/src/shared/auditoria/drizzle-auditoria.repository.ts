import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../../database/connection';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { logAuditoria } from '../../database/schema';
import { AuditoriaPort, RegistrarAuditoriaEntrada } from './auditoria.port';
import { TransactionContext } from '../persistence/transaction-context';

/** Implementación real — únicamente INSERT, nunca UPDATE/DELETE (RN-AUD-01, append-only). */
@Injectable()
export class DrizzleAuditoriaRepository implements AuditoriaPort {
  constructor(@Inject(DATABASE_CONNECTION) private readonly dbPorDefecto: Database) {}

  /** Si `UnitOfWork.ejecutar` está activo, el INSERT de auditoría entra en la misma transacción
   * que la operación de negocio que lo originó (RN-AUD-01) — no puede quedar huérfano. */
  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.dbPorDefecto;
  }

  async registrar(entrada: RegistrarAuditoriaEntrada): Promise<void> {
    await this.db.insert(logAuditoria).values({
      tipoAccion: entrada.tipoAccion,
      actor: entrada.actor,
      sucursalRelacionada: entrada.sucursalRelacionada,
      entidadAfectadaTipo: entrada.entidadAfectadaTipo,
      entidadAfectadaId: entrada.entidadAfectadaId,
      detalle: entrada.detalle,
    });
  }
}
