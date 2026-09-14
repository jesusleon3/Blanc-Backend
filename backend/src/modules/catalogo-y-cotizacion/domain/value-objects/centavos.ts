import { DomainError } from '../../../../shared/errors/domain-error';

/**
 * Importe monetario en **centavos**, siempre entero (`RN-COT-07`, Critical).
 *
 * POR QUÉ UN TIPO Y NO UN `number` A SECAS: `RN-COT-07` exige que todo valor monetario se
 * almacene y calcule como entero en la unidad mínima de la moneda, nunca como punto flotante —
 * la aritmética binaria de `float` introduce errores de redondeo inaceptables cuando hay dinero
 * real de por medio (`0.1 + 0.2 !== 0.3`). El tipo de marca (`branded type`) hace que un `number`
 * cualquiera **no sea asignable** a un campo de dinero sin pasar por `validarImporteEnCentavos()`,
 * así que la regla deja de depender de que alguien recuerde respetarla: la impone el compilador.
 *
 * CONVENCIÓN DE NOMBRES: todo campo monetario lleva el sufijo `...Centavos` (`precioBaseCentavos`,
 * `precioAdicionalCentavos`) tanto en el dominio como en las columnas de base de datos. La unidad
 * viaja en el nombre para que ningún consumidor tenga que suponerla.
 */
export type Centavos = number & { readonly __unidad: 'centavos' };

/**
 * Única puerta de entrada para construir un `Centavos`.
 *
 * Rechaza: no-enteros (un "precio" de 1500.5 centavos no existe), negativos (un servicio no tiene
 * precio negativo; un descuento sería otro concepto, no un precio base), y valores no finitos.
 */
export function validarImporteEnCentavos(valor: number, prefijoDeCodigo: string): Centavos {
  if (!Number.isFinite(valor)) {
    throw new DomainError(`${prefijoDeCodigo}_INVALIDO`, 'El importe debe ser un número finito de centavos.', 400, { valor });
  }
  if (!Number.isInteger(valor)) {
    throw new DomainError(`${prefijoDeCodigo}_INVALIDO`, 'El importe debe expresarse en centavos enteros, sin decimales (RN-COT-07).', 400, {
      valor,
    });
  }
  if (valor < 0) {
    throw new DomainError(`${prefijoDeCodigo}_INVALIDO`, 'El importe no puede ser negativo.', 400, { valor });
  }
  return valor as Centavos;
}
