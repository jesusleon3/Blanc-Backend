import { DataType, newDb } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import * as schema from '../schema';
import { Database } from '../connection';

/**
 * Base de datos Postgres en memoria (pg-mem) para pruebas de integración reales de
 * repositorios Drizzle, sin depender de Docker/una instancia Postgres real — no disponible en
 * este entorno de desarrollo (ver reporte de cierre del módulo). El DDL replica exactamente
 * las tablas de `database/schema/*.schema.ts`; si el esquema cambia, este helper debe
 * actualizarse junto con él.
 */
export function crearBaseDeDatosDePrueba(): Database {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({ name: 'gen_random_uuid', returns: DataType.uuid, implementation: () => randomUUID(), impure: true });

  const { Client } = mem.adapters.createPg();
  const client = new Client();
  // pg-mem opera de forma síncrona internamente; connect() es requerido por la interfaz de `pg`.
  void client.connect();
  const clientParaDrizzle = envolverClientSinTypeParser(client);

  mem.public.none(`
    CREATE SCHEMA sucursales_personal;
    CREATE TABLE sucursales_personal.sucursales (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text NOT NULL UNIQUE,
      numero_whatsapp_alias text,
      horario_semanal jsonb NOT NULL,
      descansos jsonb,
      en_mantenimiento boolean NOT NULL DEFAULT false,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE sucursales_personal.dias_festivos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sucursal_id uuid NOT NULL REFERENCES sucursales_personal.sucursales(id) ON DELETE CASCADE,
      fecha date NOT NULL,
      descripcion text
    );
    CREATE TABLE sucursales_personal.manicuristas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text NOT NULL,
      activa boolean NOT NULL DEFAULT true,
      creado_en timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE sucursales_personal.manicuristas_sucursales (
      manicurista_id uuid NOT NULL REFERENCES sucursales_personal.manicuristas(id) ON DELETE CASCADE,
      sucursal_id uuid NOT NULL REFERENCES sucursales_personal.sucursales(id) ON DELETE CASCADE,
      UNIQUE (manicurista_id, sucursal_id)
    );
    CREATE SCHEMA auditoria;
    CREATE TABLE auditoria.log_auditoria (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo_accion text NOT NULL,
      actor text NOT NULL,
      sucursal_relacionada uuid,
      entidad_afectada_tipo text NOT NULL,
      entidad_afectada_id uuid NOT NULL,
      detalle jsonb,
      "timestamp" timestamptz NOT NULL DEFAULT now()
    );
    CREATE SCHEMA identidad_accesos;
    CREATE TABLE identidad_accesos.usuarios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      nombre text NOT NULL,
      rol text NOT NULL,
      activa boolean NOT NULL DEFAULT true,
      supabase_user_id uuid UNIQUE,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE identidad_accesos.usuarios_sucursales (
      usuario_id uuid NOT NULL REFERENCES identidad_accesos.usuarios(id) ON DELETE CASCADE,
      sucursal_id uuid NOT NULL,
      UNIQUE (usuario_id, sucursal_id)
    );
    CREATE SCHEMA catalogo_cotizacion;
    CREATE TABLE catalogo_cotizacion.servicios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text NOT NULL,
      categoria text NOT NULL,
      duracion_base_minutos integer NOT NULL,
      -- Entero en centavos (RN-COT-07), nunca numeric ni real.
      precio_base_centavos integer NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE catalogo_cotizacion.modificadores_diseno (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text NOT NULL,
      minutos_adicionales integer NOT NULL,
      precio_adicional_centavos integer NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE catalogo_cotizacion.servicio_modificadores_aplicables (
      servicio_id uuid NOT NULL REFERENCES catalogo_cotizacion.servicios(id) ON DELETE CASCADE,
      modificador_id uuid NOT NULL REFERENCES catalogo_cotizacion.modificadores_diseno(id) ON DELETE CASCADE,
      UNIQUE (servicio_id, modificador_id)
    );
    -- Modelada sin uso (RN-COT-06/RN-COT-08: catálogo global, sin override por sucursal).
    CREATE TABLE catalogo_cotizacion.servicio_sucursal_override (
      servicio_id uuid NOT NULL REFERENCES catalogo_cotizacion.servicios(id) ON DELETE CASCADE,
      sucursal_id uuid NOT NULL,
      precio_override_centavos integer,
      duracion_override_minutos integer,
      activo_override boolean,
      UNIQUE (servicio_id, sucursal_id)
    );
  `);

  // `node-postgres` y `postgres-js` exponen una API de Drizzle estructuralmente equivalente
  // para las operaciones que este módulo usa; el cast documenta la diferencia de driver, que
  // solo importa fuera de las pruebas (ver comentario superior de este archivo).
  return drizzle(clientParaDrizzle, { schema }) as unknown as Database;
}

interface FilaConCampos {
  rows: Record<string, unknown>[] | unknown[][];
}

/**
 * `drizzle-orm/node-postgres` adjunta, a cada query, `types.getTypeParser` (parseo de
 * timestamptz/date) y `rowMode: 'array'` (para mapear resultados por posición) — ninguna de
 * las dos opciones de `pg` está soportada por pg-mem (`NotSupported`). Este wrapper, usado
 * únicamente en pruebas, elimina ambas antes de que la query llegue a pg-mem y, cuando el
 * llamador pedía `rowMode: 'array'`, convierte las filas-objeto que pg-mem sí devuelve al
 * formato posicional que Drizzle espera. pg-mem no puebla `result.fields` en modo normal, así
 * que el orden de columnas se toma de las claves de la primera fila (orden de inserción de un
 * objeto JS, que sigue el orden de columnas de la consulta) — suficiente para pruebas de un
 * único `SELECT` uniforme; no afecta el driver real (`postgres-js`) usado en producción.
 */
function envolverClientSinTypeParser<T extends { query: (...args: unknown[]) => unknown }>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'query') {
        return async (queryConfig: unknown, params: unknown) => {
          if (queryConfig && typeof queryConfig === 'object') {
            const { types: _types, rowMode, ...resto } = queryConfig as Record<string, unknown>;
            const resultado = (await target.query(resto, params)) as FilaConCampos;
            if (rowMode === 'array' && resultado.rows.length > 0) {
              const nombres = Object.keys(resultado.rows[0] as Record<string, unknown>);
              resultado.rows = (resultado.rows as Record<string, unknown>[]).map((fila) => nombres.map((nombre) => fila[nombre]));
            }
            return resultado;
          }
          return target.query(queryConfig, params);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
