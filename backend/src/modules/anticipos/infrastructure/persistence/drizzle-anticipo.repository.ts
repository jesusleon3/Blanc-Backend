import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { Database, DATABASE_CONNECTION } from '../../../../database/connection';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';
import { anticipos, EstadoAnticipo } from '../../../../database/schema';
import { Anticipo } from '../../domain/entities/anticipo.entity';
import { AnticipoRepository, ListadoDeAnticipos } from '../../domain/ports/anticipo.repository';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { esViolacionDeUnicidad, nombreDeRestriccion } from '../../../../shared/errors/postgres-error';

@Injectable()
export class DrizzleAnticipoRepository implements AnticipoRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly conexionPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.conexionPorDefecto;
  }

  async guardar(anticipo: Anticipo): Promise<void> {
    const fila = {
      id: anticipo.id,
      citaId: anticipo.citaId,
      clientaId: anticipo.clientaId,
      montoCentavos: anticipo.montoCentavos,
      porcentajeAplicado: anticipo.porcentajeAplicado,
      estado: anticipo.estado,
      referenciaPago: anticipo.referenciaPago,
      confirmadoPor: anticipo.confirmadoPor,
      confirmadoEn: anticipo.confirmadoEn,
      creadoEn: anticipo.creadoEn,
    };

    try {
      await this.db
        .insert(anticipos)
        .values(fila)
        .onConflictDoUpdate({
          target: anticipos.id,
          set: {
            estado: fila.estado,
            montoCentavos: fila.montoCentavos,
            porcentajeAplicado: fila.porcentajeAplicado,
            referenciaPago: fila.referenciaPago,
            confirmadoPor: fila.confirmadoPor,
            confirmadoEn: fila.confirmadoEn,
            actualizadoEn: new Date(),
          },
        });
    } catch (error) {
      if (esViolacionDeUnicidad(error) && nombreDeRestriccion(error) === 'anticipos_cita_unq') {
        // Dos peticiones simultáneas intentando generar el anticipo de la misma cita. La base es
        // la autoridad; esto solo hace el 409 accionable.
        throw new ConflictoDeNegocioError('ANTICIPO_YA_EXISTE', 'Esa cita ya tiene un anticipo generado.', { citaId: anticipo.citaId });
      }
      throw error;
    }
  }

  async buscarPorId(id: string): Promise<Anticipo | null> {
    const filas = await this.db.select().from(anticipos).where(eq(anticipos.id, id)).limit(1);
    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async buscarPorCita(citaId: string): Promise<Anticipo | null> {
    const filas = await this.db.select().from(anticipos).where(eq(anticipos.citaId, citaId)).limit(1);
    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async listarPorEstado(estado: EstadoAnticipo, opciones: { limite: number; desplazamiento: number }): Promise<ListadoDeAnticipos> {
    // Una fila extra para saber si hay página siguiente sin contar el total.
    const filas = await this.db
      .select()
      .from(anticipos)
      .where(eq(anticipos.estado, estado))
      // Más antiguo primero: es la lista de llamadas pendientes, y la de hace tres días urge más.
      .orderBy(asc(anticipos.creadoEn), asc(anticipos.id))
      .limit(opciones.limite + 1)
      .offset(opciones.desplazamiento);

    return {
      anticipos: filas.slice(0, opciones.limite).map((fila) => this.aEntidad(fila)),
      hayMas: filas.length > opciones.limite,
    };
  }

  private aEntidad(fila: typeof anticipos.$inferSelect): Anticipo {
    return Anticipo.reconstruir({
      id: fila.id,
      citaId: fila.citaId,
      clientaId: fila.clientaId,
      montoCentavos: fila.montoCentavos,
      porcentajeAplicado: fila.porcentajeAplicado,
      estado: fila.estado as EstadoAnticipo,
      referenciaPago: fila.referenciaPago,
      confirmadoPor: fila.confirmadoPor,
      confirmadoEn: fila.confirmadoEn,
      creadoEn: fila.creadoEn,
    });
  }
}
