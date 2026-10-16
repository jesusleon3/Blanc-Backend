-- =============================================================================================
-- MIGRACIÓN ESCRITA ENTERAMENTE A MANO.
--
-- Drizzle no la genera: el único cambio es un `CHECK`, que no sabe expresar y por tanto no ve en
-- su snapshot (`drizzle-kit generate` responde "No schema changes"). Es el mismo motivo por el que
-- existe `deriva-restricciones-conversaciones.spec.ts`: la migración es la única fuente de verdad
-- de estas restricciones, y la prueba de deriva es lo que lo hace exigible.
--
-- QUÉ AÑADE Y POR QUÉ. El motivo `medio_no_soportado`, para las conversaciones que se escalan
-- porque la clienta mandó audio, documento o un medio que el bot no puede leer (`RN-CONV-06`).
-- Antes de Fase 4 Parte 3 esos mensajes dejaban la conversación **en silencio**: se guardaban en
-- la bandeja y nadie respondía ni escalaba, así que la clienta se quedaba esperando a un bot que
-- no podía oírla.
--
-- Se recrea el `CHECK` completo en vez de intentar ampliarlo: PostgreSQL no permite añadir valores
-- a una restricción existente, y `DROP` + `ADD` dentro de la misma transacción de la migración no
-- deja ninguna ventana en la que la tabla quede sin validar.
-- =============================================================================================

ALTER TABLE "conversaciones"."conversaciones" DROP CONSTRAINT "conversaciones_motivo_valido";
--> statement-breakpoint

ALTER TABLE "conversaciones"."conversaciones"
  ADD CONSTRAINT "conversaciones_motivo_valido"
  CHECK ("motivo_de_escalamiento" IS NULL OR "motivo_de_escalamiento" IN (
    'clienta_bloqueada', 'solicitud_humana', 'queja_o_reclamo', 'cotizacion_compleja',
    'cancelacion_solicitada', 'intervencion_manual', 'baja_confianza_ia', 'fuera_de_alcance',
    'medio_no_soportado'
  ));
