import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { Database } from '../../../../database/connection';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { excepcionesPersonal, RangoHorario, TipoExcepcionPersonal } from '../../../../database/schema';
import { ExcepcionPersonal } from '../../domain/entities/excepcion-personal.entity';
import { ExcepcionPersonalRepository } from '../../domain/ports/excepcion-personal.repository';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';

@Injectable()
export class DrizzleExcepcionPersonalRepository implements ExcepcionPersonalRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly dbPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.dbPorDefecto;
  }

  async guardar(excepcion: ExcepcionPersonal): Promise<void> {
    await this.db
      .insert(excepcionesPersonal)
      .values({
        id: excepcion.id,
        manicuristaId: excepcion.manicuristaId,
        tipo: excepcion.tipo,
        sucursalId: excepcion.sucursalId,
        rango: excepcion.rango,
        motivo: excepcion.motivo,
      })
      .onConflictDoUpdate({
        target: excepcionesPersonal.id,
        set: { tipo: excepcion.tipo, sucursalId: excepcion.sucursalId, rango: excepcion.rango, motivo: excepcion.motivo },
      });
  }

  async eliminar(id: string): Promise<void> {
    await this.db.delete(excepcionesPersonal).where(eq(excepcionesPersonal.id, id));
  }

  async buscarPorId(id: string): Promise<ExcepcionPersonal | null> {
    const filas = await this.db.select().from(excepcionesPersonal).where(eq(excepcionesPersonal.id, id)).limit(1);
    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async listarQueSolapan(rango: RangoHorario): Promise<ExcepcionPersonal[]> {
    const filas = await this.db
      .select()
      .from(excepcionesPersonal)
      .where(
        sql`${excepcionesPersonal.rango} && tstzrange(${rango.inicio.toISOString()}::timestamptz, ${rango.fin.toISOString()}::timestamptz, '[)')`,
      );
    return filas.map((fila) => this.aEntidad(fila));
  }

  private aEntidad(fila: typeof excepcionesPersonal.$inferSelect): ExcepcionPersonal {
    return ExcepcionPersonal.reconstruir({
      id: fila.id,
      manicuristaId: fila.manicuristaId,
      tipo: fila.tipo as TipoExcepcionPersonal,
      sucursalId: fila.sucursalId,
      rango: fila.rango,
      motivo: fila.motivo,
    });
  }
}
