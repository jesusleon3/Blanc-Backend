import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { Database } from '../../../../database/connection';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { sillas } from '../../../../database/schema';
import { Silla } from '../../domain/entities/silla.entity';
import { SillaRepository } from '../../domain/ports/silla.repository';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';

@Injectable()
export class DrizzleSillaRepository implements SillaRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly dbPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.dbPorDefecto;
  }

  async guardar(silla: Silla): Promise<void> {
    await this.db
      .insert(sillas)
      .values({ id: silla.id, sucursalId: silla.sucursalId, nombre: silla.nombre, activa: silla.activa })
      .onConflictDoUpdate({
        target: sillas.id,
        set: { nombre: silla.nombre, activa: silla.activa, actualizadoEn: new Date() },
      });
  }

  async buscarPorId(id: string): Promise<Silla | null> {
    const filas = await this.db.select().from(sillas).where(eq(sillas.id, id)).limit(1);
    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async listarPorSucursal(sucursalId: string): Promise<Silla[]> {
    const filas = await this.db.select().from(sillas).where(eq(sillas.sucursalId, sucursalId));
    return filas.map((fila) => this.aEntidad(fila));
  }

  /** La mitad izquierda de `MIN(sillas_libres, manicuristas_activas)` (`DEC-035`). */
  async contarActivasPorSucursal(sucursalId: string): Promise<number> {
    const filas = await this.db
      .select({ total: count() })
      .from(sillas)
      .where(and(eq(sillas.sucursalId, sucursalId), eq(sillas.activa, true)));
    return filas[0]?.total ?? 0;
  }

  private aEntidad(fila: typeof sillas.$inferSelect): Silla {
    return Silla.reconstruir({ id: fila.id, sucursalId: fila.sucursalId, nombre: fila.nombre, activa: fila.activa });
  }
}
