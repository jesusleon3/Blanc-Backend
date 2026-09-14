import { Servicio } from '../../domain/entities/servicio.entity';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';

/**
 * Traduce las entidades del catálogo a la forma expuesta por la API — nunca al revés.
 *
 * Los importes salen en **centavos**, con el sufijo `...Centavos` en el nombre del campo, igual
 * que en el dominio y en las columnas (`RN-COT-07`): la unidad viaja en el nombre para que ningún
 * consumidor de la API tenga que suponerla ni dividir entre 100 a ciegas. Convertir a pesos para
 * mostrar es responsabilidad de la interfaz, no del contrato.
 */
export function servicioAJson(servicio: Servicio) {
  return {
    id: servicio.id,
    nombre: servicio.nombre,
    categoria: servicio.categoria,
    duracionBaseMinutos: servicio.duracionBaseMinutos,
    precioBaseCentavos: servicio.precioBaseCentavos,
    activo: servicio.activo,
  };
}

export function modificadorDisenoAJson(modificador: ModificadorDiseno) {
  return {
    id: modificador.id,
    nombre: modificador.nombre,
    minutosAdicionales: modificador.minutosAdicionales,
    precioAdicionalCentavos: modificador.precioAdicionalCentavos,
    activo: modificador.activo,
  };
}
