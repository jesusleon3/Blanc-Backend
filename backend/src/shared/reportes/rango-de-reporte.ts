import { RangoHorario } from '../../database/schema';
import { DomainError } from '../errors/domain-error';

/**
 * Utilidades compartidas por los reportes de cada Bounded Context.
 *
 * ## POR QUÉ VIVEN EN `shared/` Y NO EN AGENDA
 *
 * La primera versión las puso en el caso de uso de reporte de Agenda, y los de Anticipos y
 * Conversaciones las importaban de ahí. **Eso es un Bounded Context importando a otro**, que es
 * exactamente lo que `P5` cerró: *"ningún Bounded Context importa a otro, ni su código ni sus
 * tipos"*. No habría dado un ciclo en `madge`, así que la regla se habría roto sin que nada falle
 * — la misma forma de error silencioso que ya costó dos defectos en este proyecto.
 *
 * `shared/` es el sitio correcto: igual que `ZONA_HORARIA_NEGOCIO`, esto es un hecho de la
 * plataforma (cómo se acota una lectura) y no una regla de ningún dominio.
 */

/** Tope de rango. Un reporte sin acotar es un escaneo de tabla completa en producción. */
export const MAXIMO_DIAS_DE_REPORTE = 400;

/** Mismo tope y mismos códigos que las demás lecturas acotadas del sistema. */
export function exigirRangoValido(rango: RangoHorario): void {
  const { inicio, fin } = rango;
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    throw new DomainError('RANGO_INVALIDO', 'El rango del reporte contiene una fecha inválida.', 400);
  }
  if (fin.getTime() <= inicio.getTime()) {
    throw new DomainError('RANGO_INVALIDO', 'El fin del rango debe ser posterior al inicio.', 400);
  }
  const dias = (fin.getTime() - inicio.getTime()) / 86_400_000;
  if (dias > MAXIMO_DIAS_DE_REPORTE) {
    throw new DomainError(
      'RANGO_DE_CONSULTA_DEMASIADO_AMPLIO',
      `Un reporte no puede abarcar más de ${MAXIMO_DIAS_DE_REPORTE} días; se pidieron ${Math.ceil(dias)}.`,
      400,
      { maximoDias: MAXIMO_DIAS_DE_REPORTE, diasSolicitados: Math.ceil(dias) },
    );
  }
}

/**
 * `db.execute` de `postgres-js` devuelve el arreglo de filas directamente, pero el tipo que Drizzle
 * declara no lo refleja. Se centraliza el `cast` para no repetirlo en cada consulta.
 */
export function filasDe<T>(resultado: unknown): T[] {
  return resultado as unknown as T[];
}
