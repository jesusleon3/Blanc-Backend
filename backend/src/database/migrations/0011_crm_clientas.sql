CREATE SCHEMA "crm";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm"."clientas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"telefono_anterior" text,
	"estado_de_riesgo" text DEFAULT 'normal' NOT NULL,
	"sugerida_lista_roja" boolean DEFAULT false NOT NULL,
	"cancelaciones_ordinarias" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm"."incidentes_clienta" (
	"id" uuid PRIMARY KEY NOT NULL,
	"clienta_id" uuid NOT NULL,
	"cita_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"ocurrido_en" timestamp with time zone NOT NULL,
	"minutos_de_antelacion" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm"."incidentes_clienta" ADD CONSTRAINT "incidentes_clienta_clienta_id_clientas_id_fk" FOREIGN KEY ("clienta_id") REFERENCES "crm"."clientas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clientas_telefono_idx" ON "crm"."clientas" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clientas_telefono_anterior_idx" ON "crm"."clientas" USING btree ("telefono_anterior");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clientas_nombre_telefono_unq" ON "crm"."clientas" USING btree ("nombre","telefono");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidentes_clienta_idx" ON "crm"."incidentes_clienta" USING btree ("clienta_id","ocurrido_en");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "incidentes_cita_tipo_unq" ON "crm"."incidentes_clienta" USING btree ("cita_id","tipo");--> statement-breakpoint

-- =============================================================================================
-- A PARTIR DE AQUÍ, SQL ESCRITO A MANO — Drizzle no sabe expresar `CHECK`.
-- `deriva-restricciones-crm.spec.ts` los compara contra los arrays de TypeScript y falla si
-- divergen.
-- =============================================================================================

-- `RN-CRM-02` acotado a los tres estados de riesgo. `text` + `CHECK` y no un `enum` de
-- PostgreSQL, por el mismo motivo que en `agenda.citas`: `ALTER TYPE … ADD VALUE` no corre dentro
-- de la transacción en la que Drizzle envuelve cada migración — y aquí se espera añadir `vip`.
ALTER TABLE "crm"."clientas"
  ADD CONSTRAINT "clientas_estado_de_riesgo_valido"
  CHECK ("estado_de_riesgo" IN ('normal', 'lista_roja', 'bloqueada'));
--> statement-breakpoint

ALTER TABLE "crm"."incidentes_clienta"
  ADD CONSTRAINT "incidentes_tipo_valido"
  CHECK ("tipo" IN ('no_show', 'cancelacion_tardia', 'reprogramacion_tardia'));
--> statement-breakpoint

-- El contador no puede ser negativo: un número negativo de cancelaciones no significa nada, y
-- sería la huella de un decremento mal hecho en algún camino futuro.
ALTER TABLE "crm"."clientas"
  ADD CONSTRAINT "clientas_cancelaciones_no_negativas"
  CHECK ("cancelaciones_ordinarias" >= 0);
--> statement-breakpoint

-- =============================================================================================
-- UNA CLIENTA BLOQUEADA NO PUEDE ESTAR SUGERIDA PARA LISTA ROJA.
--
-- No es cosmético: bloqueada es un estado más severo que lista roja (`RN-CRM-04` impide agendar
-- del todo), así que una sugerencia pendiente de "márcala lista roja" sobre alguien ya bloqueada
-- es ruido que invita a *rebajarle* la severidad por error al atender la alerta.
-- =============================================================================================
ALTER TABLE "crm"."clientas"
  ADD CONSTRAINT "clientas_sugerencia_coherente"
  CHECK (NOT ("estado_de_riesgo" = 'bloqueada' AND "sugerida_lista_roja" = true));
