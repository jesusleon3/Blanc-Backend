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
    /**
     * La clave estable. Viaja al cliente **para que el Backoffice pueda mostrarla como solo
     * lectura** y así se vea qué filas son oficiales: una con código es parte de la matriz que el
     * bot resuelve, una con `null` la creó alguien desde el panel.
     *
     * No es un secreto ni una decisión: es un identificador. Y no hay endpoint que lo acepte como
     * entrada, ni al crear ni al editar.
     */
    codigo: servicio.codigo,
    categoria: servicio.categoria,
    duracionBaseMinutos: servicio.duracionBaseMinutos,
    precioBaseCentavos: servicio.precioBaseCentavos,
    activo: servicio.activo,
    requiereCotizacionManual: servicio.requiereCotizacionManual,
  };
}

export function modificadorDisenoAJson(modificador: ModificadorDiseno) {
  return {
    id: modificador.id,
    nombre: modificador.nombre,
    minutosAdicionales: modificador.minutosAdicionales,
    precioAdicionalCentavos: modificador.precioAdicionalCentavos,
    activo: modificador.activo,
    requiereCotizacionManual: modificador.requiereCotizacionManual,
  };
}
