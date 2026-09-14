import { DomainError } from '../../../../shared/errors/domain-error';

/**
 * `HorarioSemanal` (01-domain-discovery.md §5.7, VO). RN-AGE-10: el horario es "partido por
 * bloques discontinuos" (ej. mañana y tarde con corte de mediodía) — no un rango continuo.
 * Un arreglo vacío para un día significa que la sucursal no opera ese día (ej. domingo,
 * RN-AGE-12) — esto es un dato de configuración por sucursal, no una regla hardcodeada aquí:
 * ninguna sucursal "domingo cerrado" está forzada por este Value Object, es la data la que
 * lo confirma para Blanc.
 */
export const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export interface BloqueHorario {
  horaInicio: string; // formato "HH:mm", 24h
  horaFin: string;
}

export type HorarioSemanalData = Record<DiaSemana, BloqueHorario[]>;

const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class HorarioSemanal {
  private constructor(private readonly data: HorarioSemanalData) {}

  static crear(data: HorarioSemanalData): HorarioSemanal {
    for (const dia of DIAS_SEMANA) {
      const bloques = data[dia];
      if (!bloques) {
        throw new DomainError('HORARIO_DIA_FALTANTE', `Falta la configuración del día "${dia}" en el horario semanal.`, 400, { dia });
      }
      HorarioSemanal.validarBloquesDelDia(dia, bloques);
    }
    return new HorarioSemanal(data);
  }

  private static validarBloquesDelDia(dia: DiaSemana, bloques: BloqueHorario[]): void {
    const ordenados = [...bloques].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

    for (let i = 0; i < ordenados.length; i++) {
      const bloque = ordenados[i];
      if (!FORMATO_HORA.test(bloque.horaInicio) || !FORMATO_HORA.test(bloque.horaFin)) {
        throw new DomainError('BLOQUE_HORARIO_FORMATO_INVALIDO', `Bloque de horario inválido en "${dia}" — se espera "HH:mm".`, 400, { dia, bloque });
      }
      if (bloque.horaInicio >= bloque.horaFin) {
        throw new DomainError('BLOQUE_HORARIO_INVERTIDO', `El bloque de "${dia}" tiene la hora de inicio igual o después de la hora de fin.`, 400, { dia, bloque });
      }
      const siguiente = ordenados[i + 1];
      if (siguiente && bloque.horaFin > siguiente.horaInicio) {
        throw new DomainError('BLOQUES_HORARIO_SUPERPUESTOS', `Los bloques de "${dia}" se superponen.`, 400, { dia, bloque, siguiente });
      }
    }
  }

  estaAbiertoEl(dia: DiaSemana): boolean {
    return this.data[dia].length > 0;
  }

  toJSON(): HorarioSemanalData {
    return this.data;
  }
}
