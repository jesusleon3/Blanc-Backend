CREATE TABLE IF NOT EXISTS "sucursales_personal"."excepciones_personal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manicurista_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"sucursal_id" uuid,
	"rango" "tstzrange" NOT NULL,
	"motivo" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sucursales_personal"."excepciones_personal" ADD CONSTRAINT "excepciones_personal_manicurista_id_manicuristas_id_fk" FOREIGN KEY ("manicurista_id") REFERENCES "sucursales_personal"."manicuristas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sucursales_personal"."excepciones_personal" ADD CONSTRAINT "excepciones_personal_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales_personal"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "excepciones_personal_manicurista_idx" ON "sucursales_personal"."excepciones_personal" USING btree ("manicurista_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "excepciones_personal_sucursal_idx" ON "sucursales_personal"."excepciones_personal" USING btree ("sucursal_id");--> statement-breakpoint
-- SQL a mano: Drizzle no expresa `CHECK`.
-- Dos invariantes que el tipo de excepción impone sobre `sucursal_id` (`DEC-036`):
--   · una `cobertura` SIEMPRE dice dónde cubre — sin destino no significa nada;
--   · una `ausencia` NUNCA lleva sucursal: no se ausenta "de una sucursal", se ausenta y punto.
-- Sin esto, una cobertura sin destino quedaría guardada y restaría capacidad en la sucursal base
-- sin sumarla en ninguna otra: capacidad evaporada en silencio.
ALTER TABLE "sucursales_personal"."excepciones_personal"
  ADD CONSTRAINT "excepciones_personal_tipo_valido"
  CHECK (
    ("tipo" = 'ausencia'  AND "sucursal_id" IS NULL)
    OR
    ("tipo" = 'cobertura' AND "sucursal_id" IS NOT NULL)
  );
