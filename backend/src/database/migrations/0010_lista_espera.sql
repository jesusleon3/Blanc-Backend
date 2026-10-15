CREATE TABLE IF NOT EXISTS "agenda"."lista_espera" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"clienta_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"estado" text NOT NULL,
	"notificada_en" timestamp with time zone,
	"expira_en" timestamp with time zone,
	"hueco_inicio" timestamp with time zone,
	"cita_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agenda"."lista_espera" ADD CONSTRAINT "lista_espera_cita_id_citas_id_fk" FOREIGN KEY ("cita_id") REFERENCES "agenda"."citas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lista_espera_fila_idx" ON "agenda"."lista_espera" USING btree ("sucursal_id","fecha","estado","creado_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lista_espera_clienta_idx" ON "agenda"."lista_espera" USING btree ("clienta_id");--> statement-breakpoint

-- =============================================================================================
-- A PARTIR DE AQUÍ, SQL ESCRITO A MANO — Drizzle no sabe expresar `CHECK` ni índices parciales.
--
-- `deriva-restricciones-agenda.spec.ts` compara estas restricciones contra los arrays de
-- TypeScript y falla si divergen. Quien añada un estado tiene que tocar los dos sitios.
-- =============================================================================================

-- Lista de estados válidos (`DEC-039`). `text` + `CHECK` y no un `enum` de PostgreSQL, por el
-- mismo motivo que en `citas`: `ALTER TYPE … ADD VALUE` no corre dentro de la transacción en la
-- que Drizzle envuelve cada migración.
ALTER TABLE "agenda"."lista_espera"
  ADD CONSTRAINT "lista_espera_estado_valido"
  CHECK ("estado" IN ('en_espera', 'notificada', 'aceptada', 'expirada', 'cancelada'));
--> statement-breakpoint

-- =============================================================================================
-- EL INVARIANTE CENTRAL: **UNA SOLA CLIENTA NOTIFICADA A LA VEZ** por sucursal y fecha.
--
-- Es la regla de `DEC-039` ("se notifica a una sola clienta a la vez"), y aquí vale lo mismo que
-- para el no-doble-booking: si solo la cumpliera el código de aplicación, dos liberaciones de
-- hueco simultáneas —una cancelación y una reprogramación en el mismo segundo— podrían avisar a
-- dos clientas del mismo horario. Ambas pasarían la comprobación previa y ambas escribirían.
--
-- Un índice único PARCIAL es exactamente la herramienta: solo restringe las filas `notificada`,
-- así que no estorba a las que están en espera, ni a las aceptadas, ni al histórico de expiradas.
-- =============================================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "lista_espera_una_notificada_por_fila"
  ON "agenda"."lista_espera" ("sucursal_id", "fecha")
  WHERE "estado" = 'notificada';
--> statement-breakpoint

-- Una misma clienta no se apunta dos veces al mismo servicio, sucursal y fecha mientras su
-- solicitud siga viva. Las terminadas (`aceptada`/`expirada`/`cancelada`) quedan fuera a
-- propósito: tiene que poder volver a apuntarse después de que su turno pasara.
CREATE UNIQUE INDEX IF NOT EXISTS "lista_espera_sin_duplicados_activos"
  ON "agenda"."lista_espera" ("clienta_id", "sucursal_id", "fecha", "servicio_id")
  WHERE "estado" IN ('en_espera', 'notificada');
--> statement-breakpoint

-- Coherencia de la oferta: `notificada` exige ventana **y hueco ofrecido**; `en_espera` exige no
-- tener ninguno de los tres. Sin esto, una fila `notificada` sin `expira_en` sería una oferta que
-- nunca caduca y bloquearía la fila para siempre —el peor fallo posible aquí, porque es
-- silencioso— y una sin `hueco_inicio` sería una oferta de la que no se sabe qué se ofreció, que
-- es lo que impide pasar el turno a la siguiente.
ALTER TABLE "agenda"."lista_espera"
  ADD CONSTRAINT "lista_espera_ventana_coherente"
  CHECK (
    (
      "estado" = 'notificada'
      AND "notificada_en" IS NOT NULL
      AND "expira_en" IS NOT NULL
      AND "hueco_inicio" IS NOT NULL
      AND "expira_en" > "notificada_en"
    )
    OR ("estado" = 'en_espera' AND "notificada_en" IS NULL AND "expira_en" IS NULL AND "hueco_inicio" IS NULL)
    OR "estado" IN ('aceptada', 'expirada', 'cancelada')
  );
--> statement-breakpoint

-- `aceptada` sin cita sería una aceptación que no agendó nada; y una cita apuntada en una fila que
-- no está aceptada no significaría nada.
ALTER TABLE "agenda"."lista_espera"
  ADD CONSTRAINT "lista_espera_cita_solo_si_aceptada"
  CHECK (("estado" = 'aceptada') = ("cita_id" IS NOT NULL));
