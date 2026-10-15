CREATE SCHEMA "conversaciones";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversaciones"."conversaciones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"telefono_clienta" text NOT NULL,
	"clienta_id" uuid,
	"modo" text DEFAULT 'bot' NOT NULL,
	"motivo_de_escalamiento" text,
	"escalada_en" timestamp with time zone,
	"ultima_interaccion_entrante_en" timestamp with time zone,
	"ultimo_mensaje_en" timestamp with time zone,
	"mensajes_sin_responder" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversaciones"."mensajes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversacion_id" uuid NOT NULL,
	"wamid" text,
	"direccion" text NOT NULL,
	"emisor" text NOT NULL,
	"tipo" text DEFAULT 'texto' NOT NULL,
	"contenido" text,
	"parametros_plantilla" text,
	"estado_entrega" text DEFAULT 'pendiente' NOT NULL,
	"error_de_envio" text,
	"ocurrido_en" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversaciones"."numeros_de_sucursal" (
	"phone_number_id" text PRIMARY KEY NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"telefono_visible" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversaciones"."mensajes" ADD CONSTRAINT "mensajes_conversacion_id_conversaciones_id_fk" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"."conversaciones"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversaciones_sucursal_telefono_unq" ON "conversaciones"."conversaciones" USING btree ("sucursal_id","telefono_clienta");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversaciones_bandeja_idx" ON "conversaciones"."conversaciones" USING btree ("sucursal_id","modo","ultimo_mensaje_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversaciones_clienta_idx" ON "conversaciones"."conversaciones" USING btree ("clienta_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mensajes_wamid_unq" ON "conversaciones"."mensajes" USING btree ("wamid") WHERE wamid IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mensajes_conversacion_idx" ON "conversaciones"."mensajes" USING btree ("conversacion_id","ocurrido_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "numeros_sucursal_idx" ON "conversaciones"."numeros_de_sucursal" USING btree ("sucursal_id");--> statement-breakpoint

-- =============================================================================================
-- A PARTIR DE AQUÍ, SQL ESCRITO A MANO — Drizzle no sabe expresar `CHECK`.
-- `deriva-restricciones-conversaciones.spec.ts` los compara contra los arrays de TypeScript.
-- =============================================================================================

ALTER TABLE "conversaciones"."conversaciones"
  ADD CONSTRAINT "conversaciones_modo_valido" CHECK ("modo" IN ('bot', 'humano'));
--> statement-breakpoint

ALTER TABLE "conversaciones"."conversaciones"
  ADD CONSTRAINT "conversaciones_motivo_valido"
  CHECK ("motivo_de_escalamiento" IS NULL OR "motivo_de_escalamiento" IN (
    'clienta_bloqueada', 'solicitud_humana', 'queja_o_reclamo', 'cotizacion_compleja',
    'cancelacion_solicitada', 'intervencion_manual', 'baja_confianza_ia', 'fuera_de_alcance'
  ));
--> statement-breakpoint

-- =============================================================================================
-- EL MODO Y SU MOTIVO VAN JUNTOS.
--
-- `humano` sin motivo sería una conversación escalada que nadie sabe por qué: la Dueña no podría
-- distinguir "me escalan por quejas" de "me escalan por cotizaciones complejas", que es la lectura
-- para la que se guarda la categoría. Y un motivo con modo `bot` sería un residuo de un retorno de
-- control mal hecho, que haría parecer escalada una conversación que no lo está.
-- =============================================================================================
ALTER TABLE "conversaciones"."conversaciones"
  ADD CONSTRAINT "conversaciones_escalamiento_coherente"
  CHECK (
    ("modo" = 'humano' AND "motivo_de_escalamiento" IS NOT NULL AND "escalada_en" IS NOT NULL)
    OR ("modo" = 'bot' AND "motivo_de_escalamiento" IS NULL AND "escalada_en" IS NULL)
  );
--> statement-breakpoint

ALTER TABLE "conversaciones"."conversaciones"
  ADD CONSTRAINT "conversaciones_pendientes_no_negativos" CHECK ("mensajes_sin_responder" >= 0);
--> statement-breakpoint

ALTER TABLE "conversaciones"."mensajes"
  ADD CONSTRAINT "mensajes_direccion_valida" CHECK ("direccion" IN ('entrante', 'saliente'));
--> statement-breakpoint

ALTER TABLE "conversaciones"."mensajes"
  ADD CONSTRAINT "mensajes_emisor_valido" CHECK ("emisor" IN ('clienta', 'bot', 'humano', 'sistema'));
--> statement-breakpoint

ALTER TABLE "conversaciones"."mensajes"
  ADD CONSTRAINT "mensajes_tipo_valido" CHECK ("tipo" IN ('texto', 'plantilla', 'no_soportado'));
--> statement-breakpoint

ALTER TABLE "conversaciones"."mensajes"
  ADD CONSTRAINT "mensajes_estado_entrega_valido"
  CHECK ("estado_entrega" IN ('pendiente', 'sent', 'delivered', 'read', 'failed'));
--> statement-breakpoint

-- Dirección y emisor tienen que ser coherentes: solo la clienta emite entrantes, y la clienta
-- nunca emite salientes. Sin esto, un mensaje "entrante del bot" pasaría y falsearía el hilo.
ALTER TABLE "conversaciones"."mensajes"
  ADD CONSTRAINT "mensajes_direccion_emisor_coherentes"
  CHECK (
    ("direccion" = 'entrante' AND "emisor" = 'clienta')
    OR ("direccion" = 'saliente' AND "emisor" IN ('bot', 'humano', 'sistema'))
  );
--> statement-breakpoint

-- Un mensaje entrante SIEMPRE trae su `wamid` de Meta: es el que permite deduplicar reintentos.
-- Si pudiera ser `NULL`, un reintento se colaría sin que el índice único lo viera.
ALTER TABLE "conversaciones"."mensajes"
  ADD CONSTRAINT "mensajes_entrante_con_wamid"
  CHECK ("direccion" = 'saliente' OR "wamid" IS NOT NULL);
