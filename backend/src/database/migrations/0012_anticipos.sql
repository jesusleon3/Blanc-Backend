CREATE SCHEMA "anticipos";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anticipos"."anticipos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cita_id" uuid NOT NULL,
	"clienta_id" uuid NOT NULL,
	"monto_centavos" integer NOT NULL,
	"porcentaje_aplicado" integer,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"referencia_pago" text,
	"confirmado_por" text,
	"confirmado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "anticipos_cita_unq" ON "anticipos"."anticipos" USING btree ("cita_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anticipos_estado_idx" ON "anticipos"."anticipos" USING btree ("estado","creado_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anticipos_clienta_idx" ON "anticipos"."anticipos" USING btree ("clienta_id");--> statement-breakpoint

-- =============================================================================================
-- A PARTIR DE AQUÍ, SQL ESCRITO A MANO — Drizzle no sabe expresar `CHECK`.
-- `deriva-restricciones-anticipos.spec.ts` los compara contra los arrays de TypeScript.
-- =============================================================================================

ALTER TABLE "anticipos"."anticipos"
  ADD CONSTRAINT "anticipos_estado_valido"
  CHECK ("estado" IN ('pendiente', 'pagado', 'expirado', 'retenido'));
--> statement-breakpoint

-- Un anticipo de cero no es un anticipo: o se pide algo, o no se pide nada. `RN-COT-07` exige
-- además que sea entero, lo que el tipo `integer` ya garantiza.
ALTER TABLE "anticipos"."anticipos"
  ADD CONSTRAINT "anticipos_monto_positivo"
  CHECK ("monto_centavos" > 0);
--> statement-breakpoint

-- =============================================================================================
-- UN PAGO CONFIRMADO EXIGE REFERENCIA, QUIÉN Y CUÁNDO.
--
-- No es burocracia: sin referencia, un anticipo "pagado" es un pago que nadie puede verificar
-- después — y es justo el dato que se necesita el día que la clienta afirme que sí pagó. Sin
-- `confirmado_por`, `RN-AUD-01` queda sin respuesta a "quién lo dio por bueno". Dejarlo a la
-- aplicación significaría que un camino futuro pueda marcar `pagado` a secas y nadie lo note
-- hasta la primera reclamación.
--
-- `retenido` también los exige, porque solo se llega ahí desde `pagado` (`RN-ANT-04`).
-- =============================================================================================
ALTER TABLE "anticipos"."anticipos"
  ADD CONSTRAINT "anticipos_confirmacion_coherente"
  CHECK (
    ("estado" IN ('pagado', 'retenido') AND "referencia_pago" IS NOT NULL AND "confirmado_por" IS NOT NULL AND "confirmado_en" IS NOT NULL)
    OR ("estado" IN ('pendiente', 'expirado') AND "confirmado_en" IS NULL)
  );
--> statement-breakpoint

-- El porcentaje, si se usó, tiene que ser un porcentaje. `NULL` significa "lo fijó una persona a
-- mano" (`DEC-033`), que es distinto de `0`.
ALTER TABLE "anticipos"."anticipos"
  ADD CONSTRAINT "anticipos_porcentaje_valido"
  CHECK ("porcentaje_aplicado" IS NULL OR ("porcentaje_aplicado" > 0 AND "porcentaje_aplicado" <= 100));
