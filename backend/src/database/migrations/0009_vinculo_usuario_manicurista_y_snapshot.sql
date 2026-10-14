ALTER TABLE "identidad_accesos"."usuarios" ADD COLUMN "manicurista_id" uuid;--> statement-breakpoint
ALTER TABLE "agenda"."citas" ADD COLUMN "cotizacion_snapshot" jsonb;