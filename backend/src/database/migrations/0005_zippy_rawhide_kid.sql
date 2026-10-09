-- `btree_gist` habilita el operador `=` sobre `uuid` DENTRO de un índice GiST. Sin ella las dos
-- restricciones de exclusión del final de este archivo no se pueden crear: GiST sabe comparar
-- rangos con `&&` de serie, pero no igualdades de tipos escalares.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE SCHEMA "agenda";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agenda"."citas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"silla_id" uuid NOT NULL,
	"manicurista_id" uuid,
	"clienta_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	"rango_horario" "tstzrange" NOT NULL,
	"estado" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agenda"."sillas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agenda"."citas" ADD CONSTRAINT "citas_silla_id_sillas_id_fk" FOREIGN KEY ("silla_id") REFERENCES "agenda"."sillas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "citas_sucursal_idx" ON "agenda"."citas" USING btree ("sucursal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "citas_manicurista_idx" ON "agenda"."citas" USING btree ("manicurista_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "citas_clienta_idx" ON "agenda"."citas" USING btree ("clienta_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sillas_sucursal_idx" ON "agenda"."sillas" USING btree ("sucursal_id");
--> statement-breakpoint
-- ---------------------------------------------------------------------------------------------
-- A PARTIR DE AQUÍ, SQL ESCRITO A MANO — Drizzle no sabe expresar `CHECK` ni `EXCLUDE`.
-- Estas tres restricciones NO están en el snapshot de drizzle-kit: este archivo es su única
-- fuente de verdad. Un `drizzle-kit generate` futuro no las conoce y, por tanto, tampoco
-- intentará borrarlas — pero quien cambie la lista de estados debe editar esto a mano.
-- ---------------------------------------------------------------------------------------------

-- Lista de estados válidos (`DEC-034`). `CHECK` y no un `enum` de PostgreSQL a propósito:
-- añadir un valor a un `enum` exige `ALTER TYPE … ADD VALUE`, que no corre dentro de la
-- transacción en la que Drizzle envuelve cada migración. Faltan `no_show`,
-- `pendiente_confirmacion` y `confirmada` — ver el handoff de `PROJECT_STATUS.md`.
ALTER TABLE "agenda"."citas"
  ADD CONSTRAINT "citas_estado_valido"
  CHECK ("estado" IN ('agendada', 'en_espera_pago', 'completada', 'cancelada', 'expirada', 'reprogramada'));
--> statement-breakpoint

-- (a) CAPACIDAD FÍSICA DE LA SUCURSAL. `silla_id` es NOT NULL, así que esta restricción SIEMPRE
--     aplica: es la que convierte "Lomas tiene 3 sillas" en un invariante de base de datos en
--     lugar de una regla que la aplicación deba recordar.
ALTER TABLE "agenda"."citas"
  ADD CONSTRAINT "citas_silla_sin_solapamiento"
  EXCLUDE USING gist (
    "silla_id" WITH =,
    "rango_horario" WITH &&
  ) WHERE ("estado" NOT IN ('cancelada', 'expirada', 'reprogramada'));
--> statement-breakpoint

-- (b) LA MANICURISTA NOMBRADA NO SE DUPLICA.
--     El `manicurista_id IS NOT NULL` del WHERE es EXPLÍCITO a propósito: documenta que las citas
--     sin manicurista quedan fuera de esta restricción POR DECISIÓN, no por el accidente de que
--     en PostgreSQL `NULL = NULL` nunca da TRUE y una restricción EXCLUDE jamás se dispararía
--     entre dos filas nulas. Ese accidente, sin el patrón de Sillas Virtuales, habría permitido
--     citas simultáneas ilimitadas sin que la base protestara (`DEC-031` §2.1).
ALTER TABLE "agenda"."citas"
  ADD CONSTRAINT "citas_manicurista_sin_solapamiento"
  EXCLUDE USING gist (
    "manicurista_id" WITH =,
    "rango_horario" WITH &&
  ) WHERE ("manicurista_id" IS NOT NULL AND "estado" NOT IN ('cancelada', 'expirada', 'reprogramada'));
