import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { Database, DATABASE_CONNECTION } from '../../../../database/connection';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';
import { ESTADOS_LISTA_ESPERA_ACTIVOS, EstadoListaEspera, listaEspera } from '../../../../database/schema';
import { SolicitudListaEspera } from '../../domain/entities/solicitud-lista-espera.entity';
import { ListaEsperaRepository } from '../../domain/ports/lista-espera.repository';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { esViolacionDeUnicidad, nombreDeRestriccion } from '../../../../shared/errors/postgres-error';

@Injectable()
export class DrizzleListaEsperaRepository implements ListaEsperaRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly conexionPorDefecto: Database) {}

  /** Usa la conexión transaccional si hay una activa; si no, la del pool. */
  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.conexionPorDefecto;
  }

  async guardar(solicitud: SolicitudListaEspera): Promise<void> {
    const fila = {
      id: solicitud.id,
      sucursalId: solicitud.sucursalId,
      clientaId: solicitud.clientaId,
      servicioId: solicitud.servicioId,
      fecha: solicitud.fecha,
      estado: solicitud.estado,
      notificadaEn: solicitud.notificadaEn,
      expiraEn: solicitud.expiraEn,
      huecoInicio: solicitud.huecoInicio,
      citaId: solicitud.citaId,
      creadoEn: solicitud.creadoEn,
    };

    try {
      await this.db
        .insert(listaEspera)
        .values(fila)
        .onConflictDoUpdate({
          target: listaEspera.id,
          set: {
            estado: fila.estado,
            notificadaEn: fila.notificadaEn,
            expiraEn: fila.expiraEn,
            huecoInicio: fila.huecoInicio,
            citaId: fila.citaId,
            actualizadoEn: sql`now()`,
          },
        });
    } catch (error) {
      throw this.traducirConflicto(error);
    }
  }

  /**
   * Traduce los índices únicos **parciales** a errores de negocio.
   *
   * Los dos son condiciones de carrera reales, no fallos del sistema: dos liberaciones de hueco
   * simultáneas intentando avisar en la misma fila, o la misma clienta apuntándose dos veces
   * desde dos pestañas. La base es la autoridad; esto solo hace el 409 accionable.
   */
  private traducirConflicto(error: unknown): unknown {
    if (!esViolacionDeUnicidad(error)) return error;

    const restriccion = nombreDeRestriccion(error);
    if (restriccion === 'lista_espera_una_notificada_por_fila') {
      return new ConflictoDeNegocioError(
        'LISTA_ESPERA_YA_HAY_OFERTA_ABIERTA',
        'Ya hay una clienta con una oferta abierta para esa sucursal y fecha; se avisa a una sola a la vez.',
      );
    }
    if (restriccion === 'lista_espera_sin_duplicados_activos') {
      return new ConflictoDeNegocioError(
        'LISTA_ESPERA_DUPLICADA',
        'Esa clienta ya está en la lista de espera para ese servicio, esa sucursal y esa fecha.',
      );
    }
    return error;
  }

  async buscarPorId(id: string): Promise<SolicitudListaEspera | null> {
    const filas = await this.db.select().from(listaEspera).where(eq(listaEspera.id, id)).limit(1);
    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async listarFila(sucursalId: string, fecha: string): Promise<SolicitudListaEspera[]> {
    const filas = await this.db
      .select()
      .from(listaEspera)
      .where(
        and(
          eq(listaEspera.sucursalId, sucursalId),
          eq(listaEspera.fecha, fecha),
          inArray(listaEspera.estado, [...ESTADOS_LISTA_ESPERA_ACTIVOS]),
        ),
      )
      // El FIFO de `DEC-039` sale de aquí. `id` como desempate: dos altas en el mismo milisegundo
      // existen, y sin desempate el orden de la fila no sería determinista.
      .orderBy(asc(listaEspera.creadoEn), asc(listaEspera.id));

    return filas.map((fila) => this.aEntidad(fila));
  }

  async buscarOfertaAbierta(sucursalId: string, fecha: string): Promise<SolicitudListaEspera | null> {
    const filas = await this.db
      .select()
      .from(listaEspera)
      .where(and(eq(listaEspera.sucursalId, sucursalId), eq(listaEspera.fecha, fecha), eq(listaEspera.estado, 'notificada')))
      .limit(1);

    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async listarTurnosVencidos(ahora: Date): Promise<SolicitudListaEspera[]> {
    const filas = await this.db
      .select()
      .from(listaEspera)
      .where(and(eq(listaEspera.estado, 'notificada'), lte(listaEspera.expiraEn, ahora)))
      .orderBy(asc(listaEspera.expiraEn));

    return filas.map((fila) => this.aEntidad(fila));
  }

  private aEntidad(fila: typeof listaEspera.$inferSelect): SolicitudListaEspera {
    return SolicitudListaEspera.reconstruir({
      id: fila.id,
      sucursalId: fila.sucursalId,
      clientaId: fila.clientaId,
      servicioId: fila.servicioId,
      // `date` de PostgreSQL llega como `YYYY-MM-DD`, que es exactamente la forma del dominio.
      fecha: fila.fecha,
      estado: fila.estado as EstadoListaEspera,
      notificadaEn: fila.notificadaEn,
      expiraEn: fila.expiraEn,
      huecoInicio: fila.huecoInicio,
      citaId: fila.citaId,
      creadoEn: fila.creadoEn,
    });
  }
}
