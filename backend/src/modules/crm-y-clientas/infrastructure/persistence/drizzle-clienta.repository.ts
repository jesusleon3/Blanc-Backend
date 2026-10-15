import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { Database, DATABASE_CONNECTION } from '../../../../database/connection';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';
import { clientas, EstadoDeRiesgo, incidentesClienta, TipoDeIncidente } from '../../../../database/schema';
import { Clienta } from '../../domain/entities/clienta.entity';
import { ClientaRepository, IncidenteRegistrado, NuevoIncidente } from '../../domain/ports/clienta.repository';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { esViolacionDeUnicidad, nombreDeRestriccion } from '../../../../shared/errors/postgres-error';

@Injectable()
export class DrizzleClientaRepository implements ClientaRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly conexionPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.conexionPorDefecto;
  }

  async guardar(clienta: Clienta): Promise<void> {
    const fila = {
      id: clienta.id,
      nombre: clienta.nombre,
      telefono: clienta.telefono,
      telefonoAnterior: clienta.telefonoAnterior,
      estadoDeRiesgo: clienta.estadoDeRiesgo,
      sugeridaListaRoja: clienta.sugeridaListaRoja,
      cancelacionesOrdinarias: clienta.cancelacionesOrdinarias,
      creadoEn: clienta.creadoEn,
    };

    try {
      await this.db
        .insert(clientas)
        .values(fila)
        .onConflictDoUpdate({
          target: clientas.id,
          set: {
            nombre: fila.nombre,
            telefono: fila.telefono,
            telefonoAnterior: fila.telefonoAnterior,
            estadoDeRiesgo: fila.estadoDeRiesgo,
            sugeridaListaRoja: fila.sugeridaListaRoja,
            cancelacionesOrdinarias: fila.cancelacionesOrdinarias,
            actualizadoEn: new Date(),
          },
        });
    } catch (error) {
      if (esViolacionDeUnicidad(error) && nombreDeRestriccion(error) === 'clientas_nombre_telefono_unq') {
        throw new ConflictoDeNegocioError('CLIENTA_DUPLICADA', 'Ya existe una clienta con ese nombre y ese teléfono.', {
          nombre: clienta.nombre,
        });
      }
      throw error;
    }
  }

  async buscarPorId(id: string): Promise<Clienta | null> {
    const filas = await this.db.select().from(clientas).where(eq(clientas.id, id)).limit(1);
    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async buscarPorIds(ids: string[]): Promise<Clienta[]> {
    // Sin ids no hay consulta: `inArray` con lista vacía genera SQL inválido en algunos motores y
    // en el mejor caso es una ida a la base para no traer nada.
    if (ids.length === 0) return [];
    const filas = await this.db.select().from(clientas).where(inArray(clientas.id, ids));
    return filas.map((fila) => this.aEntidad(fila));
  }

  async buscarPorTelefono(telefono: string): Promise<Clienta[]> {
    const filas = await this.db.select().from(clientas).where(eq(clientas.telefono, telefono)).orderBy(clientas.nombre);
    return filas.map((fila) => this.aEntidad(fila));
  }

  async buscarPorNombreYTelefonoAnterior(nombre: string, telefonoAnterior: string): Promise<Clienta[]> {
    const filas = await this.db
      .select()
      .from(clientas)
      .where(and(eq(clientas.nombre, nombre), eq(clientas.telefonoAnterior, telefonoAnterior)));
    return filas.map((fila) => this.aEntidad(fila));
  }

  async registrarIncidente(incidente: NuevoIncidente): Promise<void> {
    try {
      await this.db.insert(incidentesClienta).values({
        id: randomUUID(),
        clientaId: incidente.clientaId,
        citaId: incidente.citaId,
        tipo: incidente.tipo,
        ocurridoEn: incidente.ocurridoEn,
        minutosDeAntelacion: incidente.minutosDeAntelacion,
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error) && nombreDeRestriccion(error) === 'incidentes_cita_tipo_unq') {
        throw new ConflictoDeNegocioError('INCIDENTE_YA_REGISTRADO', 'Ese incidente ya estaba registrado para esa cita.', {
          citaId: incidente.citaId,
          tipo: incidente.tipo,
        });
      }
      throw error;
    }
  }

  async listarIncidentes(clientaId: string): Promise<IncidenteRegistrado[]> {
    const filas = await this.db
      .select()
      .from(incidentesClienta)
      .where(eq(incidentesClienta.clientaId, clientaId))
      // Lo más reciente primero: es lo que la Dueña mira al decidir.
      .orderBy(desc(incidentesClienta.ocurridoEn));

    return filas.map((fila) => ({
      id: fila.id,
      citaId: fila.citaId,
      tipo: fila.tipo as TipoDeIncidente,
      ocurridoEn: fila.ocurridoEn,
      minutosDeAntelacion: fila.minutosDeAntelacion,
    }));
  }

  private aEntidad(fila: typeof clientas.$inferSelect): Clienta {
    return Clienta.reconstruir({
      id: fila.id,
      nombre: fila.nombre,
      telefono: fila.telefono,
      telefonoAnterior: fila.telefonoAnterior,
      estadoDeRiesgo: fila.estadoDeRiesgo as EstadoDeRiesgo,
      sugeridaListaRoja: fila.sugeridaListaRoja,
      cancelacionesOrdinarias: fila.cancelacionesOrdinarias,
      creadoEn: fila.creadoEn,
    });
  }
}
