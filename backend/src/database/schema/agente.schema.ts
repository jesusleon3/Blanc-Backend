import { date, integer, pgSchema } from 'drizzle-orm/pg-core';

export const agenteSchema = pgSchema('agente');

/**
 * Consumo diario de llamadas al modelo de lenguaje — **el cortacircuitos de `F-07`**.
 *
 * ## POR QUÉ UNA TABLA Y NO UN CONTADOR EN MEMORIA
 *
 * Un contador en memoria habría sido una línea de código, y habría protegido justo del caso que no
 * importa. Lo que `F-07` teme es el **gasto descontrolado**: un bucle, una clienta mandando
 * mensajes en ráfaga, o un ataque de correo basura. Y en ese escenario lo probable es que el
 * proceso se reinicie —Railway reinicia ante un fallo— y un contador en memoria **volvería a cero
 * en cada reinicio**: el tope no se alcanzaría nunca y el gasto seguiría.
 *
 * Con la cuenta en la base, el tope sobrevive a reinicios y es compartido entre instancias.
 *
 * ## UNA FILA POR DÍA, Y LA FECHA ES LA CLAVE
 *
 * `fecha` es la **fecha de pared de Querétaro**, no UTC: el presupuesto es diario y "el día" es el
 * día del salón. La clave primaria natural hace que el incremento sea un solo `INSERT … ON
 * CONFLICT DO UPDATE`, atómico, sin leer antes.
 *
 * **No se guarda nada de la conversación**: ni texto, ni teléfono, ni id. Solo cuántas llamadas se
 * hicieron ese día. Es una tabla de consumo, no de auditoría (`RN-AUD-01`).
 */
export const consumoDeIa = agenteSchema.table('consumo_de_ia', {
  /** Fecha de pared del negocio, `YYYY-MM-DD`. Clave primaria: una fila por día. */
  fecha: date('fecha').primaryKey(),
  llamadas: integer('llamadas').notNull().default(0),
});
