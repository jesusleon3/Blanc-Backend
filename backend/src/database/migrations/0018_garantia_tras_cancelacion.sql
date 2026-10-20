-- SQL ESCRITO A MANO — Drizzle no sabe expresar un indice parcial y NO esta en su snapshot.
--
-- DECISION DE NEGOCIO DE LA DUEÑA (2026-10-19) — cierra la Tension 1 de la auditoria.
--
-- Un servicio completado se honra con UNA reposicion. La pregunta abierta era cuando una
-- reposicion agendada "gasta" ese derecho, y la respuesta elegida depende de QUIEN fallo:
--
--   * `cancelada` / `expirada` → la reposicion no se hizo, y la causa habitual es del salon (una
--     manicurista que falta, un cierre imprevisto). La clienta CONSERVA su derecho: el trabajo
--     sigue mal hecho y nadie se lo ha arreglado. Antes de esta migracion no podia darsele otra, y
--     no habia forma de anularlo desde el panel.
--   * `reprogramada` → no es un final, es la misma garantia movida de hora. Ya estaba excluida
--     desde la `0017`.
--   * `no_show` / `completada` → siguen BLOQUEANDO, y es el centro de la regla: en el primer caso
--     el salon aparto la silla y la clienta no vino; en el segundo, ya se repuso. En los dos
--     cumplio. Una tercera la decide la Dueña caso por caso (RN-GAR-04), fuera del sistema.
--
-- El predicado es el array `ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA` de `agenda.schema.ts`, y
-- `deriva-restricciones-agenda.spec.ts` compara los dos: si divergen, falla.
DROP INDEX IF EXISTS "agenda"."citas_garantia_unica_por_origen";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "citas_garantia_unica_por_origen"
  ON "agenda"."citas" ("cita_garantizada_id")
  WHERE "es_garantia" = true AND "estado" NOT IN ('reprogramada', 'cancelada', 'expirada');
