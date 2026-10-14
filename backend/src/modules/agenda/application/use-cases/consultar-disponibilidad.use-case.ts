import { Injectable } from '@nestjs/common';
import { CapacidadEfectiva, MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { RangoHorario } from '../../../../database/schema';
import { DomainError } from '../../../../shared/errors/domain-error';

export interface ConsultaDisponibilidad extends CapacidadEfectiva {
  hayLugar: boolean;
  /** Código del motivo cuando no hay lugar, para que quien pregunte pueda explicarlo. */
  motivo?: string;
}

/**
 * Caso de uso de **lectura**: "¿cabe una cita aquí?". Sin transacción ni auditoría — `RN-AUD-01`
 * audita cambios de configuración, no consultas.
 *
 * Lo necesitará el bot de WhatsApp para proponer horarios sin tener que intentar reservarlos y
 * fallar. Devuelve el desglose completo (sillas, manicuristas y el mínimo) porque "no hay lugar"
 * y "no hay quien atienda" son conversaciones distintas con la clienta, aunque el resultado
 * numérico sea el mismo.
 *
 * **No reserva nada y no congela el hueco.** Entre la respuesta y la reserva real otra clienta
 * puede adelantarse: la autoridad sigue siendo la restricción de PostgreSQL (`DEC-035`).
 */
@Injectable()
export class ConsultarDisponibilidadUseCase {
  constructor(private readonly motorDisponibilidad: MotorDisponibilidad) {}

  async ejecutar(input: { sucursalId: string; rangoHorario: RangoHorario }): Promise<ConsultaDisponibilidad> {
    try {
      await this.motorDisponibilidad.exigirHorarioValido(input.sucursalId, input.rangoHorario);
    } catch (error) {
      if (error instanceof DomainError) {
        return { sillasLibres: 0, manicuristasDisponibles: 0, capacidad: 0, hayLugar: false, motivo: error.code };
      }
      throw error;
    }

    const capacidad = await this.motorDisponibilidad.calcularCapacidad(input.sucursalId, input.rangoHorario);
    return {
      ...capacidad,
      hayLugar: capacidad.capacidad > 0,
      motivo: capacidad.capacidad > 0 ? undefined : capacidad.sillasLibres > 0 ? 'SIN_MANICURISTAS_DISPONIBLES' : 'SIN_SILLAS_LIBRES',
    };
  }
}
