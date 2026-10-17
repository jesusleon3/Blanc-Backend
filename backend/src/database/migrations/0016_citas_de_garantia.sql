ALTER TABLE "agenda"."citas" ADD COLUMN "es_garantia" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agenda"."citas" ADD COLUMN "cita_garantizada_id" uuid;
--> statement-breakpoint
-- CHECK escrito a mano: Drizzle no sabe expresarlo y NO está en su snapshot.
--
-- Los dos campos de garantia van JUNTOS O NINGUNO. Una garantia sin cita de origen no se podria
-- verificar contra la ventana de 7 dias (RN-GAR-01) ni contra el estado `completada` (RN-GAR-02),
-- y una cita normal con `cita_garantizada_id` seria un dato sin sentido que alguien interpretaria
-- como garantia. Mismo criterio que `conversaciones_escalamiento_coherente`.
ALTER TABLE "agenda"."citas"
  ADD CONSTRAINT "citas_garantia_coherente" CHECK (
    ("es_garantia" = false AND "cita_garantizada_id" IS NULL)
    OR ("es_garantia" = true AND "cita_garantizada_id" IS NOT NULL)
  );
--> statement-breakpoint
-- Una cita completada se honra UNA sola vez: sin esto, dos personas atendiendo a la vez podrian
-- crear dos reposiciones gratuitas del mismo servicio. Indice parcial porque solo aplica a las
-- filas de garantia, y de paso resuelve la consulta "¿esta cita ya tiene garantia?".
CREATE UNIQUE INDEX IF NOT EXISTS "citas_garantia_unica_por_origen"
  ON "agenda"."citas" ("cita_garantizada_id")
  WHERE "es_garantia" = true;
