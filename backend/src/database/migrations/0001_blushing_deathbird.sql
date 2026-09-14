CREATE SCHEMA "identidad_accesos";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identidad_accesos"."usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"rol" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"supabase_user_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identidad_accesos"."usuarios_sucursales" (
	"usuario_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identidad_accesos"."usuarios_sucursales" ADD CONSTRAINT "usuarios_sucursales_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidad_accesos"."usuarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_unico" ON "identidad_accesos"."usuarios" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_supabase_user_id_unico" ON "identidad_accesos"."usuarios" USING btree ("supabase_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_sucursales_par_unico" ON "identidad_accesos"."usuarios_sucursales" USING btree ("usuario_id","sucursal_id");