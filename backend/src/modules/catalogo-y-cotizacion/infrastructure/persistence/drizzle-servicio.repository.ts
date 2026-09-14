import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Database } from '../../../../database/connection';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { servicioModificadoresAplicables, servicios } from '../../../../database/schema';
import { Servicio } from '../../domain/entities/servicio.entity';
import { ServicioRepository } from '../../domain/ports/servicio.repository';
import { validarImporteEnCentavos } from '../../domain/value-objects/centavos';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';
import { esViolacionDeUnicidad } from '../../../../shared/errors/postgres-error';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';

@Injectable()
export class DrizzleServicioRepository implements ServicioRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly dbPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.dbPorDefecto;
  }

  async guardar(servicio: Servicio): Promise<void> {
    await this.db
      .insert(servicios)
      .values({
        id: servicio.id,
        nombre: servicio.nombre,
        categoria: servicio.categoria,
        duracionBaseMinutos: servicio.duracionBaseMinutos,
        precioBaseCentavos: servicio.precioBaseCentavos,
        activo: servicio.activo,
      })
      .onConflictDoUpdate({
        target: servicios.id,
        set: {
          nombre: servicio.nombre,
          categoria: servicio.categoria,
          duracionBaseMinutos: servicio.duracionBaseMinutos,
          precioBaseCentavos: servicio.precioBaseCentavos,
          activo: servicio.activo,
          actualizadoEn: new Date(),
        },
      });
  }

  async buscarPorId(id: string): Promise<Servicio | null> {
    const filas = await this.db.select().from(servicios).where(eq(servicios.id, id)).limit(1);
    if (filas.length === 0) return null;
    return this.aEntidad(filas[0]);
  }

  async listar(): Promise<Servicio[]> {
    const filas = await this.db.select().from(servicios);
    return filas.map((fila) => this.aEntidad(fila));
  }

  async vincularModificador(servicioId: string, modificadorId: string): Promise<void> {
    try {
      await this.db.insert(servicioModificadoresAplicables).values({ servicioId, modificadorId });
    } catch (error) {
      // Backstop de base de datos contra la misma condición de carrera (TOCTOU) que
      // `VincularModificadorAServicioUseCase` ya valida antes con `estaModificadorVinculado`.
      // Mismo patrón que `DrizzleManicuristaRepository.asignarASucursal`: el 23505 crudo nunca
      // sale hacia arriba.
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictoDeNegocioError('MODIFICADOR_YA_VINCULADO', 'El modificador ya está vinculado a este servicio.', {
          servicioId,
          modificadorId,
        });
      }
      throw error;
    }
  }

  async desvincularModificador(servicioId: string, modificadorId: string): Promise<void> {
    await this.db
      .delete(servicioModificadoresAplicables)
      .where(
        and(
          eq(servicioModificadoresAplicables.servicioId, servicioId),
          eq(servicioModificadoresAplicables.modificadorId, modificadorId),
        ),
      );
  }

  async listarModificadoresDeServicio(servicioId: string): Promise<string[]> {
    const filas = await this.db
      .select({ modificadorId: servicioModificadoresAplicables.modificadorId })
      .from(servicioModificadoresAplicables)
      .where(eq(servicioModificadoresAplicables.servicioId, servicioId));
    return filas.map((fila) => fila.modificadorId);
  }

  async estaModificadorVinculado(servicioId: string, modificadorId: string): Promise<boolean> {
    const filas = await this.db
      .select()
      .from(servicioModificadoresAplicables)
      .where(
        and(
          eq(servicioModificadoresAplicables.servicioId, servicioId),
          eq(servicioModificadoresAplicables.modificadorId, modificadorId),
        ),
      )
      .limit(1);
    return filas.length > 0;
  }

  /**
   * Mapeo fila → entidad. El importe vuelve a pasar por `validarImporteEnCentavos()` en lugar de
   * castearse: ese validador es la única puerta de entrada al tipo `Centavos` (`RN-COT-07`), y
   * saltárselo con un `as` en el adaptador dejaría al tipo de marca sin garantía justo en la
   * frontera donde entra dato externo. La columna es `integer`, así que en operación normal no
   * puede fallar; si algún día lanza, significa que el esquema derivó (p. ej. a `numeric`, que el
   * driver entregaría como `string`) y es preferible enterarse ahí que propagar un precio corrupto
   * hacia una cotización.
   */
  private aEntidad(fila: typeof servicios.$inferSelect): Servicio {
    return Servicio.reconstruir({
      id: fila.id,
      nombre: fila.nombre,
      categoria: fila.categoria,
      duracionBaseMinutos: fila.duracionBaseMinutos,
      precioBaseCentavos: validarImporteEnCentavos(fila.precioBaseCentavos, 'SERVICIO_PRECIO_BASE'),
      activo: fila.activo,
    });
  }
}
