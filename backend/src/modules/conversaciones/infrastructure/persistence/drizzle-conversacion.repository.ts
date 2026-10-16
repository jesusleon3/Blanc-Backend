import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, min } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { Database, DATABASE_CONNECTION } from '../../../../database/connection';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';
import {
  conversaciones,
  DireccionMensaje,
  EmisorMensaje,
  EstadoEntrega,
  mensajes,
  ModoConversacion,
  MotivoDeEscalamiento,
  numerosDeSucursal,
  TipoMensaje,
} from '../../../../database/schema';
import { Conversacion } from '../../domain/entities/conversacion.entity';
import {
  ConversacionRepository,
  EscaladasPendientes,
  MensajeRegistrado,
  NuevoMensaje,
  PaginaDeConversaciones,
} from '../../domain/ports/conversacion.repository';

@Injectable()
export class DrizzleConversacionRepository implements ConversacionRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly conexionPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.conexionPorDefecto;
  }

  async guardar(conversacion: Conversacion): Promise<void> {
    const fila = {
      id: conversacion.id,
      sucursalId: conversacion.sucursalId,
      telefonoClienta: conversacion.telefonoClienta,
      clientaId: conversacion.clientaId,
      modo: conversacion.modo,
      motivoDeEscalamiento: conversacion.motivoDeEscalamiento,
      escaladaEn: conversacion.escaladaEn,
      ultimaInteraccionEntranteEn: conversacion.ultimaInteraccionEntranteEn,
      ultimoMensajeEn: conversacion.ultimoMensajeEn,
      mensajesSinResponder: conversacion.mensajesSinResponder,
      creadoEn: conversacion.creadoEn,
    };

    await this.db
      .insert(conversaciones)
      .values(fila)
      .onConflictDoUpdate({
        target: conversaciones.id,
        set: {
          clientaId: fila.clientaId,
          modo: fila.modo,
          motivoDeEscalamiento: fila.motivoDeEscalamiento,
          escaladaEn: fila.escaladaEn,
          ultimaInteraccionEntranteEn: fila.ultimaInteraccionEntranteEn,
          ultimoMensajeEn: fila.ultimoMensajeEn,
          mensajesSinResponder: fila.mensajesSinResponder,
          actualizadoEn: new Date(),
        },
      });
  }

  async buscarPorId(id: string): Promise<Conversacion | null> {
    const filas = await this.db.select().from(conversaciones).where(eq(conversaciones.id, id)).limit(1);
    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async buscarPorSucursalYTelefono(sucursalId: string, telefonoClienta: string): Promise<Conversacion | null> {
    const filas = await this.db
      .select()
      .from(conversaciones)
      .where(and(eq(conversaciones.sucursalId, sucursalId), eq(conversaciones.telefonoClienta, telefonoClienta)))
      .limit(1);

    return filas.length === 0 ? null : this.aEntidad(filas[0]);
  }

  async listarParaBandeja(filtros: {
    sucursalId?: string;
    modo?: ModoConversacion;
    soloPendientes?: boolean;
    limite: number;
    desplazamiento: number;
  }): Promise<PaginaDeConversaciones> {
    const condiciones = [
      ...(filtros.sucursalId ? [eq(conversaciones.sucursalId, filtros.sucursalId)] : []),
      ...(filtros.modo ? [eq(conversaciones.modo, filtros.modo)] : []),
      ...(filtros.soloPendientes ? [gt(conversaciones.mensajesSinResponder, 0)] : []),
    ];

    // Una fila extra para saber si hay página siguiente sin contar el total.
    const filas = await this.db
      .select()
      .from(conversaciones)
      .where(condiciones.length > 0 ? and(...condiciones) : undefined)
      // La bandeja es una cola de trabajo: lo más reciente primero. `id` desempata para que el
      // orden sea determinista entre páginas.
      .orderBy(desc(conversaciones.ultimoMensajeEn), asc(conversaciones.id))
      .limit(filtros.limite + 1)
      .offset(filtros.desplazamiento);

    return {
      conversaciones: filas.slice(0, filtros.limite).map((fila) => this.aEntidad(fila)),
      hayMas: filas.length > filtros.limite,
    };
  }

  async contarEscaladasPendientes(filtros: { sucursalId?: string }): Promise<EscaladasPendientes> {
    const condiciones = [
      eq(conversaciones.modo, 'humano'),
      gt(conversaciones.mensajesSinResponder, 0),
      ...(filtros.sucursalId ? [eq(conversaciones.sucursalId, filtros.sucursalId)] : []),
    ];

    // Agrupado en la base, no en memoria: el contador se sondea cada pocos segundos desde el panel
    // y traerse las filas para contarlas en Node haría crecer el coste con la bandeja.
    const filas = await this.db
      .select({
        sucursalId: conversaciones.sucursalId,
        total: count(),
        masAntiguaEn: min(conversaciones.ultimaInteraccionEntranteEn),
      })
      .from(conversaciones)
      .where(and(...condiciones))
      .groupBy(conversaciones.sucursalId)
      .orderBy(asc(conversaciones.sucursalId));

    // `min()` sobre una columna `timestamptz` vuelve como cadena en `postgres-js`, así que se
    // normaliza aquí: el dominio recibe `Date` o `null`, nunca una cadena que parezca una fecha.
    const instantes = filas
      .map((fila) => (fila.masAntiguaEn === null ? null : new Date(fila.masAntiguaEn as unknown as string)))
      .filter((instante): instante is Date => instante !== null);

    return {
      total: filas.reduce((suma, fila) => suma + Number(fila.total), 0),
      porSucursal: filas.map((fila) => ({ sucursalId: fila.sucursalId, total: Number(fila.total) })),
      masAntiguaEn: instantes.length > 0 ? new Date(Math.min(...instantes.map((i) => i.getTime()))) : null,
    };
  }

  async listarMensajes(conversacionId: string, opciones: { limite: number; desplazamiento: number }): Promise<MensajeRegistrado[]> {
    const filas = await this.db
      .select()
      .from(mensajes)
      .where(eq(mensajes.conversacionId, conversacionId))
      // Cronológico: es un hilo de chat, se lee de arriba abajo.
      .orderBy(asc(mensajes.ocurridoEn), asc(mensajes.id))
      .limit(opciones.limite)
      .offset(opciones.desplazamiento);

    return filas.map((fila) => ({
      id: fila.id,
      wamid: fila.wamid,
      direccion: fila.direccion as DireccionMensaje,
      emisor: fila.emisor as EmisorMensaje,
      tipo: fila.tipo as TipoMensaje,
      contenido: fila.contenido,
      estadoEntrega: fila.estadoEntrega as EstadoEntrega,
      errorDeEnvio: fila.errorDeEnvio,
      ocurridoEn: fila.ocurridoEn,
    }));
  }

  /**
   * `false` si el `wamid` ya existía — ver la nota del puerto sobre por qué no lanza.
   *
   * La deduplicación la decide **el índice único de la base**, no una consulta previa: dos
   * reintentos simultáneos de Meta pasarían los dos un `SELECT` de comprobación y escribirían los
   * dos.
   */
  async registrarMensaje(mensaje: NuevoMensaje): Promise<boolean> {
    /**
     * `ON CONFLICT DO NOTHING`, **no un `try/catch` sobre el error de unicidad**.
     *
     * Y la diferencia no es estilística: este `INSERT` corre **dentro de una transacción**, y en
     * PostgreSQL un statement que falla **aborta la transacción entera** (`25P02`). Capturar el
     * `23505` y devolver `false` parecía funcionar, pero dejaba la transacción en estado abortado:
     * el `COMMIT` posterior fallaba y el error original salía de todas formas. Se descubrió
     * exactamente así, con la prueba del `wamid` repetido.
     *
     * `DO NOTHING` nunca falla, así que la transacción sigue viva y el reintento de Meta se
     * resuelve como lo que es: una inserción que no hizo nada. `returning()` vacío **es** la señal
     * de duplicado.
     *
     * Sin `target`: cubre cualquier conflicto, que en esta tabla es el `wamid` (la colisión de un
     * uuid v4 como clave primaria no es un escenario real).
     */
    const filas = await this.db
      .insert(mensajes)
      .values({
        id: randomUUID(),
        conversacionId: mensaje.conversacionId,
        wamid: mensaje.wamid,
        direccion: mensaje.direccion,
        emisor: mensaje.emisor,
        tipo: mensaje.tipo,
        contenido: mensaje.contenido,
        parametrosPlantilla: mensaje.parametrosPlantilla ?? null,
        estadoEntrega: mensaje.estadoEntrega ?? 'pendiente',
        ocurridoEn: mensaje.ocurridoEn,
      })
      .onConflictDoNothing()
      .returning({ id: mensajes.id });

    return filas.length > 0;
  }

  async actualizarEstadoDeEntrega(wamid: string, estado: EstadoEntrega, errorDeEnvio?: string | null): Promise<boolean> {
    const filas = await this.db
      .update(mensajes)
      .set({ estadoEntrega: estado, errorDeEnvio: errorDeEnvio ?? null })
      .where(eq(mensajes.wamid, wamid))
      .returning({ id: mensajes.id });

    return filas.length > 0;
  }

  async buscarSucursalDeNumero(phoneNumberId: string): Promise<string | null> {
    const filas = await this.db
      .select({ sucursalId: numerosDeSucursal.sucursalId })
      .from(numerosDeSucursal)
      .where(eq(numerosDeSucursal.phoneNumberId, phoneNumberId))
      .limit(1);

    return filas.length === 0 ? null : filas[0].sucursalId;
  }

  async registrarNumeroDeSucursal(input: { phoneNumberId: string; sucursalId: string; telefonoVisible: string }): Promise<void> {
    await this.db
      .insert(numerosDeSucursal)
      .values(input)
      .onConflictDoUpdate({
        target: numerosDeSucursal.phoneNumberId,
        set: { sucursalId: input.sucursalId, telefonoVisible: input.telefonoVisible },
      });
  }

  async buscarNumeroDeSucursal(sucursalId: string): Promise<string | null> {
    const filas = await this.db
      .select({ phoneNumberId: numerosDeSucursal.phoneNumberId })
      .from(numerosDeSucursal)
      .where(eq(numerosDeSucursal.sucursalId, sucursalId))
      .limit(1);

    return filas.length === 0 ? null : filas[0].phoneNumberId;
  }

  private aEntidad(fila: typeof conversaciones.$inferSelect): Conversacion {
    return Conversacion.reconstruir({
      id: fila.id,
      sucursalId: fila.sucursalId,
      telefonoClienta: fila.telefonoClienta,
      clientaId: fila.clientaId,
      modo: fila.modo as ModoConversacion,
      motivoDeEscalamiento: fila.motivoDeEscalamiento as MotivoDeEscalamiento | null,
      escaladaEn: fila.escaladaEn,
      ultimaInteraccionEntranteEn: fila.ultimaInteraccionEntranteEn,
      ultimoMensajeEn: fila.ultimoMensajeEn,
      mensajesSinResponder: fila.mensajesSinResponder,
      creadoEn: fila.creadoEn,
    });
  }
}
