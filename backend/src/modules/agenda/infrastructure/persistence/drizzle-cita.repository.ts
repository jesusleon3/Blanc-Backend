import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, notInArray, sql } from 'drizzle-orm';
import { Database } from '../../../../database/connection';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { citas, ESTADOS_QUE_LIBERAN_HORARIO, EstadoCita, RangoHorario } from '../../../../database/schema';
import { Cita } from '../../domain/entities/cita.entity';
import { CitaRepository } from '../../domain/ports/cita.repository';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';
import { esViolacionDeExclusion, nombreDeRestriccion } from '../../../../shared/errors/postgres-error';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';

/** Literal de rango para comparar con `&&` en SQL. `[)` — fin exclusivo, igual que el customType. */
function aRangoSql(rango: RangoHorario) {
  return sql`tstzrange(${rango.inicio.toISOString()}::timestamptz, ${rango.fin.toISOString()}::timestamptz, '[)')`;
}

@Injectable()
export class DrizzleCitaRepository implements CitaRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly dbPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.dbPorDefecto;
  }

  async guardar(cita: Cita): Promise<void> {
    try {
      await this.db
        .insert(citas)
        .values({
          id: cita.id,
          sucursalId: cita.sucursalId,
          sillaId: cita.sillaId,
          manicuristaId: cita.manicuristaId,
          clientaId: cita.clientaId,
          servicioId: cita.servicioId,
          rangoHorario: cita.rangoHorario,
          estado: cita.estado,
        })
        .onConflictDoUpdate({
          target: citas.id,
          set: {
            sillaId: cita.sillaId,
            manicuristaId: cita.manicuristaId,
            rangoHorario: cita.rangoHorario,
            estado: cita.estado,
            actualizadoEn: new Date(),
          },
        });
    } catch (error) {
      throw this.traducirConflicto(error, cita);
    }
  }

  /**
   * Traduce el `23P01` de PostgreSQL a un error de negocio accionable.
   *
   * Distinguir **cuál** de las dos restricciones saltó importa para la persona que está al
   * teléfono: "no hay lugar a esa hora" y "esa manicurista ya está ocupada" llevan a
   * conversaciones distintas. Un 409 genérico obligaría a adivinar.
   */
  private traducirConflicto(error: unknown, cita: Cita): unknown {
    if (!esViolacionDeExclusion(error)) return error;

    const restriccion = nombreDeRestriccion(error);
    const detalle = { sillaId: cita.sillaId, manicuristaId: cita.manicuristaId, inicio: cita.rangoHorario.inicio.toISOString() };

    if (restriccion === 'citas_manicurista_sin_solapamiento') {
      return new ConflictoDeNegocioError('MANICURISTA_OCUPADA', 'Esa manicurista ya tiene una cita que se solapa con este horario.', detalle);
    }
    return new ConflictoDeNegocioError('SILLA_OCUPADA', 'No hay lugar disponible en la sucursal para ese horario.', detalle);
  }

  async buscarPorId(id: string): Promise<Cita | null> {
    const filas = await this.db.select().from(citas).where(eq(citas.id, id)).limit(1);
    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async listarQueOcupanEnRango(sucursalId: string, rango: RangoHorario): Promise<Cita[]> {
    const filas = await this.db
      .select()
      .from(citas)
      .where(
        and(
          eq(citas.sucursalId, sucursalId),
          notInArray(citas.estado, [...ESTADOS_QUE_LIBERAN_HORARIO]),
          sql`${citas.rangoHorario} && ${aRangoSql(rango)}`,
        ),
      );
    return filas.map((fila) => this.aEntidad(fila));
  }

  async tieneCitasFuturasQueOcupan(manicuristaId: string, desde: Date): Promise<boolean> {
    const filas = await this.db
      .select({ id: citas.id })
      .from(citas)
      .where(
        and(
          eq(citas.manicuristaId, manicuristaId),
          notInArray(citas.estado, [...ESTADOS_QUE_LIBERAN_HORARIO]),
          gte(sql`lower(${citas.rangoHorario})`, desde.toISOString()),
        ),
      )
      .limit(1);
    return filas.length > 0;
  }

  private aEntidad(fila: typeof citas.$inferSelect): Cita {
    return Cita.reconstruir({
      id: fila.id,
      sucursalId: fila.sucursalId,
      sillaId: fila.sillaId,
      manicuristaId: fila.manicuristaId,
      clientaId: fila.clientaId,
      servicioId: fila.servicioId,
      rangoHorario: fila.rangoHorario,
      estado: fila.estado as EstadoCita,
    });
  }
}
