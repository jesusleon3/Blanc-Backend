ALTER TABLE "agenda"."citas" ADD COLUMN "cita_origen_id" uuid;--> statement-breakpoint
ALTER TABLE "agenda"."citas" ADD COLUMN "numero_de_reprogramaciones" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- ---------------------------------------------------------------------------------------------
-- SQL ESCRITO A MANO — Drizzle no conoce ni la FK a sí misma ni las restricciones `EXCLUDE`.
-- ---------------------------------------------------------------------------------------------

-- Trazabilidad de la cadena de reprogramaciones. FK dentro del MISMO esquema, por tanto legítima
-- (`ADR-005` solo prohíbe las cruzadas entre esquemas).
ALTER TABLE "agenda"."citas"
  ADD CONSTRAINT "citas_cita_origen_id_fk"
  FOREIGN KEY ("cita_origen_id") REFERENCES "agenda"."citas"("id");
--> statement-breakpoint

-- =============================================================================================
-- CORRECCIÓN DE FONDO: `en_espera_pago` pasa a LIBERAR el horario.
--
-- `DEC-034` lo había listado entre los estados que OCUPAN, con la justificación "mientras el
-- anticipo no expire, el espacio es suyo". Eso contradice frontalmente a `RN-ANT-03`, que está
-- APROBADA y dice lo contrario:
--
--     "no existe una retención temporal real del horario. Mientras el anticipo esté pendiente, el
--      horario permanece disponible para cualquier otra clienta — el primero en pagar se queda
--      con el cupo, protegido por el invariante de exclusión ya existente, sin necesitar un
--      mecanismo de expiración propio."
--
-- Gana la regla de negocio: era una decisión del negocio, y `DEC-034` la contradijo por error al
-- proponer la lista. El propio `RN-ANT-03` describe el mecanismo que esto habilita — la carrera
-- entre dos clientas de lista roja NO se resuelve reteniendo el hueco, sino al confirmar el pago,
-- cuando la cita pasa a un estado que sí ocupa y la restricción de exclusión decide quién se
-- queda. Con `en_espera_pago` ocupando, esa carrera no podía ni existir.
--
-- Efecto práctico: dos citas en `en_espera_pago` pueden coexistir sobre la misma silla y horario.
-- La transición a `agendada`/`confirmada` es la que puede fallar con `SILLA_OCUPADA`, y eso es
-- exactamente el comportamiento aprobado.
-- =============================================================================================

ALTER TABLE "agenda"."citas" DROP CONSTRAINT "citas_silla_sin_solapamiento";
--> statement-breakpoint
ALTER TABLE "agenda"."citas"
  ADD CONSTRAINT "citas_silla_sin_solapamiento"
  EXCLUDE USING gist (
    "silla_id" WITH =,
    "rango_horario" WITH &&
  ) WHERE ("estado" NOT IN ('cancelada', 'expirada', 'reprogramada', 'en_espera_pago'));
--> statement-breakpoint

ALTER TABLE "agenda"."citas" DROP CONSTRAINT "citas_manicurista_sin_solapamiento";
--> statement-breakpoint
ALTER TABLE "agenda"."citas"
  ADD CONSTRAINT "citas_manicurista_sin_solapamiento"
  EXCLUDE USING gist (
    "manicurista_id" WITH =,
    "rango_horario" WITH &&
  ) WHERE ("manicurista_id" IS NOT NULL AND "estado" NOT IN ('cancelada', 'expirada', 'reprogramada', 'en_espera_pago'));
