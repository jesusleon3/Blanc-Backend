-- Alineación de la lista de estados de `agenda.citas` con `DEC-034` (2026-10-14).
--
-- De 6 valores a 9: se añaden `pendiente_confirmacion`, `confirmada` y `no_show`.
--   · `no_show` lo necesita `RN-CRM-06` para disparar la sugerencia de lista roja.
--   · `pendiente_confirmacion`/`confirmada` los exige `RN-CONV-11`: la confirmación es
--     interactiva, la clienta debe responder, y sin ese par no hay forma de distinguir una cita
--     propuesta de una aceptada.
--
-- POR QUÉ ESTO ES UN `DROP`/`ADD CONSTRAINT` Y NO UN `ALTER TYPE`: la columna se declaró como
-- `text` + `CHECK` justamente previendo esta ampliación. Un `enum` de PostgreSQL habría exigido
-- `ALTER TYPE … ADD VALUE`, que no corre dentro de la transacción en la que Drizzle envuelve cada
-- migración. Esta migración es la factura de esa decisión, y salió barata.
--
-- LAS DOS RESTRICCIONES `EXCLUDE USING gist` NO SE TOCAN, Y ESO ES INTENCIONAL. Su `WHERE` está
-- escrito por la NEGATIVA — `estado NOT IN ('cancelada','expirada','reprogramada')` — de modo que
-- todo estado nuevo ocupa horario por defecto. Los tres que se añaden aquí ocupan, que es
-- exactamente lo que `DEC-034` establece. Si alguna vez se añade un estado que deba LIBERAR el
-- horario, habrá que editar ambos `WHERE` además de este `CHECK`.

ALTER TABLE "agenda"."citas" DROP CONSTRAINT IF EXISTS "citas_estado_valido";
--> statement-breakpoint
ALTER TABLE "agenda"."citas"
  ADD CONSTRAINT "citas_estado_valido"
  CHECK ("estado" IN (
    'agendada',
    'pendiente_confirmacion',
    'confirmada',
    'en_espera_pago',
    'completada',
    'no_show',
    'cancelada',
    'expirada',
    'reprogramada'
  ));
