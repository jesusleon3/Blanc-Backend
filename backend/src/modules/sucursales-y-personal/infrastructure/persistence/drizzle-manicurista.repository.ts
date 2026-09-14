import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Database } from '../../../../database/connection';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { manicuristas, manicuristasSucursales } from '../../../../database/schema';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';
import { esViolacionDeUnicidad } from '../../../../shared/errors/postgres-error';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';

@Injectable()
export class DrizzleManicuristaRepository implements ManicuristaRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly dbPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.dbPorDefecto;
  }

  async guardar(manicurista: Manicurista): Promise<void> {
    await this.db
      .insert(manicuristas)
      .values({ id: manicurista.id, nombre: manicurista.nombre, activa: manicurista.activa })
      .onConflictDoUpdate({
        target: manicuristas.id,
        set: { nombre: manicurista.nombre, activa: manicurista.activa },
      });
  }

  async buscarPorId(id: string): Promise<Manicurista | null> {
    const filas = await this.db.select().from(manicuristas).where(eq(manicuristas.id, id)).limit(1);
    if (filas.length === 0) return null;
    return Manicurista.reconstruir(filas[0]);
  }

  async listar(): Promise<Manicurista[]> {
    const filas = await this.db.select().from(manicuristas);
    return filas.map((fila) => Manicurista.reconstruir(fila));
  }

  async asignarASucursal(manicuristaId: string, sucursalId: string): Promise<void> {
    try {
      await this.db.insert(manicuristasSucursales).values({ manicuristaId, sucursalId });
    } catch (error) {
      // Backstop de base de datos contra la misma condición de carrera (TOCTOU) que
      // `AsignarManicuristaASucursalUseCase.estaAsignadaASucursal` ya valida antes.
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictoDeNegocioError('MANICURISTA_YA_ASIGNADA', 'La manicurista ya está asignada a esta sucursal.', {
          manicuristaId,
          sucursalId,
        });
      }
      throw error;
    }
  }

  async removerDeSucursal(manicuristaId: string, sucursalId: string): Promise<void> {
    await this.db
      .delete(manicuristasSucursales)
      .where(and(eq(manicuristasSucursales.manicuristaId, manicuristaId), eq(manicuristasSucursales.sucursalId, sucursalId)));
  }

  async listarSucursalesDeManicurista(manicuristaId: string): Promise<string[]> {
    const filas = await this.db
      .select({ sucursalId: manicuristasSucursales.sucursalId })
      .from(manicuristasSucursales)
      .where(eq(manicuristasSucursales.manicuristaId, manicuristaId));
    return filas.map((fila) => fila.sucursalId);
  }

  async estaAsignadaASucursal(manicuristaId: string, sucursalId: string): Promise<boolean> {
    const filas = await this.db
      .select()
      .from(manicuristasSucursales)
      .where(and(eq(manicuristasSucursales.manicuristaId, manicuristaId), eq(manicuristasSucursales.sucursalId, sucursalId)))
      .limit(1);
    return filas.length > 0;
  }
}
