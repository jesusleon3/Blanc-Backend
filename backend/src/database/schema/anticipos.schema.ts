import { index, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const anticiposSchema = pgSchema('anticipos');

/**
 * Estados de un anticipo (`RN-ANT-02`, `RN-ANT-03`, `RN-ANT-04`).
 *
 * `pendiente` → `pagado` → `retenido`, o `pendiente` → `expirado`.
 *
 * **`retenido` no es un estado administrativo cualquiera: es la materialización de `RN-ANT-04`.**
 * *"Ningún anticipo pagado se reembolsa, bajo ninguna circunstancia."* Cuando la cita muere
 * —cancelada o no-show— con el anticipo ya pagado, el dinero **se queda**. Hacía falta un estado
 * propio: dejarlo en `pagado` diría que hay un servicio pendiente de dar, y devolverlo a
 * `pendiente` diría que falta cobrar. `retenido` dice la verdad: se cobró y no habrá servicio.
 */
export const ESTADOS_ANTICIPO = ['pendiente', 'pagado', 'expirado', 'retenido'] as const;
export type EstadoAnticipo = (typeof ESTADOS_ANTICIPO)[number];

/** Estados en los que el dinero **está en poder del salón**. */
export const ESTADOS_ANTICIPO_COBRADOS = ['pagado', 'retenido'] as const satisfies readonly EstadoAnticipo[];

/**
 * `anticipos.anticipos` — aggregate raíz del Bounded Context de Anticipos.
 *
 * SOLO EXISTE PARA CLIENTAS EN LISTA ROJA (`RN-ANT-01`). No hay una fila por cita: hay una fila
 * por cada cita que nació en `en_espera_pago`, que son exactamente las de clientas de riesgo.
 *
 * CERO PASARELA DE PAGOS. El dinero llega por **transferencia bancaria externa** y una persona lo
 * confirma aquí registrando la referencia. Esta tabla no es un libro contable ni pretende serlo:
 * es el registro de que alguien del salón vio el comprobante.
 */
export const anticipos = anticiposSchema.table(
  'anticipos',
  {
    id: uuid('id').primaryKey(),
    /** Sin FK: `agenda` es otro Bounded Context (`ADR-005`). */
    citaId: uuid('cita_id').notNull(),
    /** Sin FK: `crm` es otro Bounded Context. Se guarda para poder conciliar por clienta. */
    clientaId: uuid('clienta_id').notNull(),
    /** `RN-COT-07` — centavos enteros, nunca pesos ni coma flotante. */
    montoCentavos: integer('monto_centavos').notNull(),
    /**
     * Porcentaje aplicado al calcular, **congelado** en la fila.
     *
     * POR QUÉ SE GUARDA Y NO SE RECALCULA. Es el mismo principio que `cotizacion_snapshot`
     * (`RN-AGE-08`): si la Dueña cambia el porcentaje de 40 a 50, los anticipos ya calculados
     * siguen siendo lo que se le dijo a la clienta. Sin esta columna, un reporte histórico
     * dividiría montos viejos por el porcentaje nuevo y daría cifras falsas.
     *
     * `NULL` cuando el monto lo fijó una persona a mano (`DEC-033`, servicio sin precio
     * calculable): entonces no hubo porcentaje, y un `0` mentiría.
     */
    porcentajeAplicado: integer('porcentaje_aplicado'),
    estado: text('estado').notNull().default('pendiente'),
    /**
     * Referencia o folio de la transferencia. **Obligatoria para confirmar** (lo impone un
     * `CHECK`): un pago confirmado sin referencia es un pago que nadie puede verificar después, y
     * es justo el dato que se necesita cuando la clienta dice que sí pagó.
     */
    referenciaPago: text('referencia_pago'),
    /** `sub` de quien confirmó. `RN-AUD-01`: toda confirmación tiene una persona detrás. */
    confirmadoPor: text('confirmado_por'),
    confirmadoEn: timestamp('confirmado_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    /**
     * **Un anticipo por cita.** Sin esto, dos peticiones simultáneas crearían dos anticipos de la
     * misma cita y la clienta podría acabar pagando dos veces — o peor, confirmando uno y
     * dejando el otro pendiente, con la cita atascada en `en_espera_pago` para siempre.
     */
    unoPorCita: uniqueIndex('anticipos_cita_unq').on(tabla.citaId),
    // La consulta caliente: "qué transferencias estoy esperando".
    porEstado: index('anticipos_estado_idx').on(tabla.estado, tabla.creadoEn),
    porClienta: index('anticipos_clienta_idx').on(tabla.clientaId),
  }),
);
