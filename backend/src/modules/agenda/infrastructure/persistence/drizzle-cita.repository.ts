import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, lte, notInArray, sql } from 'drizzle-orm';
import { Database } from '../../../../database/connection';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { citas, ESTADOS_QUE_LIBERAN_HORARIO, ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA, ESTADOS_VISIBLES_EN_AGENDA, EstadoCita, RangoHorario } from '../../../../database/schema';
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
          cotizacionSnapshot: cita.cotizacionSnapshot,
          citaOrigenId: cita.citaOrigenId,
          esGarantia: cita.esGarantia,
          citaGarantizadaId: cita.citaGarantizadaId,
          numeroDeReprogramaciones: cita.numeroDeReprogramaciones,
        })
        .onConflictDoUpdate({
          target: citas.id,
          set: {
            sillaId: cita.sillaId,
            manicuristaId: cita.manicuristaId,
            rangoHorario: cita.rangoHorario,
            estado: cita.estado,
            cotizacionSnapshot: cita.cotizacionSnapshot,
            esGarantia: cita.esGarantia,
            citaGarantizadaId: cita.citaGarantizadaId,
            citaOrigenId: cita.citaOrigenId,
            numeroDeReprogramaciones: cita.numeroDeReprogramaciones,
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

  async listarQueOcupanDeManicuristaEnRango(manicuristaId: string, rango: RangoHorario): Promise<Cita[]> {
    const filas = await this.db
      .select()
      .from(citas)
      .where(
        and(
          eq(citas.manicuristaId, manicuristaId),
          notInArray(citas.estado, [...ESTADOS_QUE_LIBERAN_HORARIO]),
          sql`${citas.rangoHorario} && ${aRangoSql(rango)}`,
        ),
      );
    return filas.map((fila) => this.aEntidad(fila));
  }

  async listarParaConsulta(
    sucursalId: string,
    rango: RangoHorario,
    opciones: { manicuristaId?: string; limite: number; desplazamiento: number },
  ): Promise<Cita[]> {
    const filas = await this.db
      .select()
      .from(citas)
      .where(
        and(
          eq(citas.sucursalId, sucursalId),
          // `ESTADOS_VISIBLES_EN_AGENDA`, no "las que ocupan": una cita `en_espera_pago` libera el
          // horario pero tiene que verse, porque es la que hay que perseguir para cobrar el
          // anticipo. Ver la nota del array en el esquema.
          inArray(citas.estado, [...ESTADOS_VISIBLES_EN_AGENDA]),
          sql`${citas.rangoHorario} && ${aRangoSql(rango)}`,
          // Filtro en SQL, no en memoria: ver la nota del puerto sobre por qué con `LIMIT` esto
          // no es equivalente.
          ...(opciones.manicuristaId ? [eq(citas.manicuristaId, opciones.manicuristaId)] : []),
        ),
      )
      // Orden estable: sin él, dos páginas consecutivas pueden repetir u omitir filas.
      .orderBy(sql`lower(${citas.rangoHorario})`, citas.id)
      .limit(opciones.limite)
      .offset(opciones.desplazamiento);

    return filas.map((fila) => this.aEntidad(fila));
  }

  async buscarPendienteDeConfirmacionDeClienta(sucursalId: string, clientaId: string): Promise<Cita | null> {
    const filas = await this.db
      .select()
      .from(citas)
      .where(
        and(
          eq(citas.sucursalId, sucursalId),
          eq(citas.clientaId, clientaId),
          eq(citas.estado, 'pendiente_confirmacion'),
        ),
      )
      // La más próxima primero: si hubiera dos esperando confirmación, la inminente es la que el
      // recordatorio acaba de anunciar y por tanto la que la clienta está contestando.
      .orderBy(sql`lower(${citas.rangoHorario})`)
      .limit(1);

    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  /**
   * ¿Este servicio completado ya tiene una garantía que **consuma el derecho**?
   *
   * ## EL PREDICADO ES EL MISMO QUE EL DEL ÍNDICE, Y AHORA SÍ TIENE QUE SERLO
   *
   * Hasta la migración `0018` esta consulta miraba **cualquier** estado a propósito, y estaba
   * documentado: el índice solo excluía `reprogramada`, y aquí se quería responder *"¿ya se
   * concedió?"* —una garantía reprogramada sí se concedió—.
   *
   * La decisión de la Dueña cambió la pregunta. Si una reposición `cancelada` **no gasta** el
   * derecho, esta consulta tiene que dejar pasar ese caso: de lo contrario el caso de uso
   * rechazaría con `GARANTIA_YA_OTORGADA` **antes** de que la base tuviera ocasión de permitirlo, y
   * la regla nueva no serviría de nada. Las dos barreras tienen que decir lo mismo.
   *
   * Se comparte el array `ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA` con el `WHERE` de la migración, y
   * `deriva-restricciones-agenda.spec.ts` comprueba que no se separen.
   */
  async existeGarantiaDe(citaGarantizadaId: string): Promise<boolean> {
    const filas = await this.db
      .select({ id: citas.id })
      .from(citas)
      .where(
        and(
          eq(citas.citaGarantizadaId, citaGarantizadaId),
          eq(citas.esGarantia, true),
          notInArray(citas.estado, [...ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA]),
        ),
      )
      .limit(1);

    return filas.length > 0;
  }

  async listarActivasYaTerminadas(ahora: Date, limite: number): Promise<Cita[]> {
    const filas = await this.db
      .select()
      .from(citas)
      .where(
        and(
          inArray(citas.estado, ['agendada', 'pendiente_confirmacion', 'confirmada']),
          // `upper()` es el fin del rango. `<=` porque el rango es `[inicio, fin)`: en el instante
          // `fin` la cita ya no ocupa, así que ya terminó.
          lte(sql`upper(${citas.rangoHorario})`, ahora.toISOString()),
        ),
      )
      // Las más antiguas primero: son las que llevan más tiempo falseando la ocupación.
      .orderBy(sql`upper(${citas.rangoHorario})`)
      .limit(limite);

    return filas.map((fila) => this.aEntidad(fila));
  }

  async listarEnEsperaDePagoVencidas(ahora: Date, limite: number): Promise<Cita[]> {
    const filas = await this.db
      .select()
      .from(citas)
      .where(and(eq(citas.estado, 'en_espera_pago'), lte(sql`lower(${citas.rangoHorario})`, ahora.toISOString())))
      .orderBy(sql`lower(${citas.rangoHorario})`)
      .limit(limite);

    return filas.map((fila) => this.aEntidad(fila));
  }

  async listarProximasSinRecordatorio(desde: Date, hasta: Date, limite: number): Promise<Cita[]> {
    const filas = await this.db
      .select()
      .from(citas)
      .where(
        and(
          eq(citas.estado, 'agendada'),
          gte(sql`lower(${citas.rangoHorario})`, desde.toISOString()),
          lte(sql`lower(${citas.rangoHorario})`, hasta.toISOString()),
        ),
      )
      .orderBy(sql`lower(${citas.rangoHorario})`)
      .limit(limite);

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
      cotizacionSnapshot: fila.cotizacionSnapshot,
      citaOrigenId: fila.citaOrigenId,
      esGarantia: fila.esGarantia,
      citaGarantizadaId: fila.citaGarantizadaId,
      numeroDeReprogramaciones: fila.numeroDeReprogramaciones,
    });
  }
}
