-- SQL ESCRITO A MANO — Drizzle no sabe expresar un indice parcial y NO esta en su snapshot.
--
-- CORRIGE UN DEFECTO DE LA MIGRACION 0016 (auditoria 2026-10-17).
--
-- `citas_garantia_unica_por_origen` protege el invariante correcto —un servicio completado se
-- honra una sola vez— pero su predicado era demasiado amplio: `WHERE es_garantia = true`, sin
-- mirar el estado. Y reprogramar una cita en Blanc **no mueve la fila**: la original pasa a
-- `reprogramada` y nace una fila nueva enlazada por `cita_origen_id` (DEC-042, porque la cadena de
-- reprogramaciones es un dato de negocio con tope de 3).
--
-- Consecuencia: al mover la hora de una reposicion, las dos filas —la `reprogramada` y la nueva—
-- compartian `cita_garantizada_id` con `es_garantia = true`, y el indice lo rechazaba con `23505`.
-- La clienta a la que se le estropeo el trabajo **no podia cambiar la hora de su reposicion**, y
-- el error que recibia el mostrador era un 500, porque `23505` sobre este indice no tiene
-- traduccion de dominio.
--
-- Se excluye `reprogramada`, y SOLO `reprogramada`. No es una decision de politica: una garantia
-- reprogramada no esta "sin honrar", esta movida — la fila nueva sigue ocupando el hueco y sigue
-- contando para el indice. Lo que se corrige es contar dos veces la misma garantia.
--
-- `cancelada`, `expirada` y `no_show` siguen bloqueando a proposito: si una reposicion se cancela,
-- que la obligacion siga en pie o no es una decision de la Dueña (RN-GAR-04 le reserva el
-- beneficio), no del sistema. Queda registrado como tension abierta en PROJECT_STATUS §16.
DROP INDEX IF EXISTS "agenda"."citas_garantia_unica_por_origen";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "citas_garantia_unica_por_origen"
  ON "agenda"."citas" ("cita_garantizada_id")
  WHERE "es_garantia" = true AND "estado" <> 'reprogramada';
