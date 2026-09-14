CREATE SCHEMA "catalogo_cotizacion";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogo_cotizacion"."modificadores_diseno" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"minutos_adicionales" integer NOT NULL,
	"precio_adicional_centavos" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogo_cotizacion"."servicio_modificadores_aplicables" (
	"servicio_id" uuid NOT NULL,
	"modificador_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogo_cotizacion"."servicio_sucursal_override" (
	"servicio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"precio_override_centavos" integer,
	"duracion_override_minutos" integer,
	"activo_override" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogo_cotizacion"."servicios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text NOT NULL,
	"duracion_base_minutos" integer NOT NULL,
	"precio_base_centavos" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalogo_cotizacion"."servicio_modificadores_aplicables" ADD CONSTRAINT "servicio_modificadores_aplicables_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "catalogo_cotizacion"."servicios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalogo_cotizacion"."servicio_modificadores_aplicables" ADD CONSTRAINT "servicio_modificadores_aplicables_modificador_id_modificadores_diseno_id_fk" FOREIGN KEY ("modificador_id") REFERENCES "catalogo_cotizacion"."modificadores_diseno"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalogo_cotizacion"."servicio_sucursal_override" ADD CONSTRAINT "servicio_sucursal_override_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "catalogo_cotizacion"."servicios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "servicio_modificadores_par_unico" ON "catalogo_cotizacion"."servicio_modificadores_aplicables" USING btree ("servicio_id","modificador_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "servicio_sucursal_override_par_unico" ON "catalogo_cotizacion"."servicio_sucursal_override" USING btree ("servicio_id","sucursal_id");