import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { Database } from '../../../../database/connection';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { modificadoresDiseno } from '../../../../database/schema';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';
import { ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';
import { validarImporteEnCentavos } from '../../domain/value-objects/centavos';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';

@Injectable()
export class DrizzleModificadorDisenoRepository implements ModificadorDisenoRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly dbPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.dbPorDefecto;
  }

  async guardar(modificador: ModificadorDiseno): Promise<void> {
    await this.db
      .insert(modificadoresDiseno)
      .values({
        id: modificador.id,
        nombre: modificador.nombre,
        minutosAdicionales: modificador.minutosAdicionales,
        precioAdicionalCentavos: modificador.precioAdicionalCentavos,
        activo: modificador.activo,
      })
      .onConflictDoUpdate({
        target: modificadoresDiseno.id,
        set: {
          nombre: modificador.nombre,
          minutosAdicionales: modificador.minutosAdicionales,
          precioAdicionalCentavos: modificador.precioAdicionalCentavos,
          activo: modificador.activo,
          actualizadoEn: new Date(),
        },
      });
  }

  async buscarPorId(id: string): Promise<ModificadorDiseno | null> {
    const filas = await this.db.select().from(modificadoresDiseno).where(eq(modificadoresDiseno.id, id)).limit(1);
    if (filas.length === 0) return null;
    return this.aEntidad(filas[0]);
  }

  async listar(): Promise<ModificadorDiseno[]> {
    const filas = await this.db.select().from(modificadoresDiseno);
    return filas.map((fila) => this.aEntidad(fila));
  }

  async listarPorIds(ids: string[]): Promise<ModificadorDiseno[]> {
    // `inArray` con una lista vacía genera SQL inválido en Postgres; además, no hay nada que
    // consultar. El corto-circuito es correctitud, no micro-optimización.
    if (ids.length === 0) return [];

    const filas = await this.db.select().from(modificadoresDiseno).where(inArray(modificadoresDiseno.id, ids));
    return filas.map((fila) => this.aEntidad(fila));
  }

  /** Mismo criterio que `DrizzleServicioRepository.aEntidad()` sobre revalidar el importe. */
  private aEntidad(fila: typeof modificadoresDiseno.$inferSelect): ModificadorDiseno {
    return ModificadorDiseno.reconstruir({
      id: fila.id,
      nombre: fila.nombre,
      minutosAdicionales: fila.minutosAdicionales,
      precioAdicionalCentavos: validarImporteEnCentavos(fila.precioAdicionalCentavos, 'MODIFICADOR_PRECIO_ADICIONAL'),
      activo: fila.activo,
    });
  }
}
