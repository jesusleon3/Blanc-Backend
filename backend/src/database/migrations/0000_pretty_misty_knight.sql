CREATE SCHEMA "sucursales_personal";
--> statement-breakpoint
CREATE SCHEMA "auditoria";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sucursales_personal"."dias_festivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"descripcion" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sucursales_personal"."manicuristas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sucursales_personal"."manicuristas_sucursales" (
	"manicurista_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sucursales_personal"."sucursales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"numero_whatsapp_alias" text,
	"horario_semanal" jsonb NOT NULL,
	"descansos" jsonb,
	"en_mantenimiento" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auditoria"."log_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo_accion" text NOT NULL,
	"actor" text NOT NULL,
	"sucursal_relacionada" uuid,
	"entidad_afectada_tipo" text NOT NULL,
	"entidad_afectada_id" uuid NOT NULL,
	"detalle" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sucursales_personal"."dias_festivos" ADD CONSTRAINT "dias_festivos_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales_personal"."sucursales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sucursales_personal"."manicuristas_sucursales" ADD CONSTRAINT "manicuristas_sucursales_manicurista_id_manicuristas_id_fk" FOREIGN KEY ("manicurista_id") REFERENCES "sucursales_personal"."manicuristas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sucursales_personal"."manicuristas_sucursales" ADD CONSTRAINT "manicuristas_sucursales_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales_personal"."sucursales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "manicuristas_sucursales_par_unico" ON "sucursales_personal"."manicuristas_sucursales" USING btree ("manicurista_id","sucursal_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sucursales_nombre_unico" ON "sucursales_personal"."sucursales" USING btree ("nombre");