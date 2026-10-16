CREATE SCHEMA "agente";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agente"."consumo_de_ia" (
	"fecha" date PRIMARY KEY NOT NULL,
	"llamadas" integer DEFAULT 0 NOT NULL
);

--> statement-breakpoint
-- CHECK escrito a mano: Drizzle no sabe expresarlo y por tanto NO está en su snapshot.
-- `llamadas` no puede ser negativo: un contador de consumo en negativo significaría que el
-- incremento se usó mal, y el cortacircuitos dejaría de disparar en silencio.
ALTER TABLE "agente"."consumo_de_ia"
  ADD CONSTRAINT "consumo_de_ia_llamadas_no_negativas" CHECK ("llamadas" >= 0);
