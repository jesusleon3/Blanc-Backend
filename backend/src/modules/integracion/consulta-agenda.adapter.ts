import { Inject, Injectable } from '@nestjs/common';
import { CitaAfectada, ConsultaAgendaPort } from '../sucursales-y-personal/domain/ports/consulta-agenda.port';
import { CITA_REPOSITORY, CitaRepository } from '../agenda/domain/ports/cita.repository';
import { MotorDisponibilidad } from '../agenda/domain/services/motor-disponibilidad';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../sucursales-y-personal/domain/ports/manicurista.repository';
import { RangoHorario } from '../../database/schema';
import { Cita } from '../agenda/domain/entities/cita.entity';

/**
 * Responde a Personal qué citas quedan comprometidas al registrar una excepción (`DEC-036`).
 *
 * Vive aquí porque necesita ver los **dos** Bounded Contexts a la vez, y ninguno de ellos puede
 * importar al otro sin crear un ciclo.
 */
@Injectable()
export class ConsultaAgendaAdapter implements ConsultaAgendaPort {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citas: CitaRepository,
    @Inject(MANICURISTA_REPOSITORY) private readonly manicuristas: ManicuristaRepository,
    private readonly motor: MotorDisponibilidad,
  ) {}

  async citasAfectadasPorExcepcion(manicuristaId: string, rango: RangoHorario): Promise<CitaAfectada[]> {
    // (1) Las que llevan su nombre: se quedan literalmente sin quién las atienda.
    const directas = await this.citas.listarQueOcupanDeManicuristaEnRango(manicuristaId, rango);
    const afectadas: CitaAfectada[] = directas.map((cita) => this.aDto(cita, 'manicurista_ausente'));

    // (2) Las que no llevan nombre pero quedan **en una franja** con sobrecupo. Sin esta segunda
    // clase, quitar a una manicurista de una sucursal llena parecería inofensivo solo porque
    // ninguna cita llevaba su nombre — y alguien se quedaría sin atender igual.
    const sucursales = await this.manicuristas.listarSucursalesDeManicurista(manicuristaId);
    const yaIncluidas = new Set(afectadas.map((c) => c.id));

    // Caché por rango: varias citas comparten horario, y recalcular la capacidad para cada una
    // repetiría la misma consulta. La clave es el rango exacto, no la sucursal: cada iteración ya
    // está dentro de una sucursal concreta.
    for (const sucursalId of sucursales) {
      const activas = await this.citas.listarQueOcupanEnRango(sucursalId, rango);
      const deficitPorRango = new Map<string, number>();

      for (const cita of activas) {
        // Solo las que no llevan nombre: las nombradas ya entraron por la vía (1), y una cita con
        // OTRA manicurista asignada no se ve afectada por esta ausencia.
        if (cita.manicuristaId !== null || yaIncluidas.has(cita.id)) continue;

        const clave = `${cita.rangoHorario.inicio.toISOString()}|${cita.rangoHorario.fin.toISOString()}`;
        if (!deficitPorRango.has(clave)) {
          // EL DÉFICIT SE MIDE EN EL RANGO DE LA PROPIA CITA, no en el de la excepción.
          //
          // Medirlo sobre el rango completo de la excepción era el origen del ruido, y de algo
          // peor que ruido: una ausencia de todo el día agregaba las citas de las 9:00 con las de
          // las 17:00 y las comparaba contra el personal del día entero. Eso daba dos errores a la
          // vez — señalaba citas de horas tranquilas que nadie iba a dejar sin atender, y podía
          // ocultar un sobrecupo real de una franja concreta dentro de un promedio diario que
          // cuadraba. La capacidad es por instante, no por día.
          const { deficitDePersonal } = await this.motor.calcularCapacidad(cita.sucursalId, cita.rangoHorario);
          deficitPorRango.set(clave, deficitDePersonal);
        }

        if (deficitPorRango.get(clave)! > 0) {
          afectadas.push(this.aDto(cita, 'sobrecupo_en_sucursal'));
          yaIncluidas.add(cita.id);
        }
      }
    }

    return afectadas;
  }

  private aDto(cita: Cita, motivo: CitaAfectada['motivo']): CitaAfectada {
    return {
      id: cita.id,
      sucursalId: cita.sucursalId,
      manicuristaId: cita.manicuristaId,
      inicio: cita.rangoHorario.inicio.toISOString(),
      fin: cita.rangoHorario.fin.toISOString(),
      estado: cita.estado,
      motivo,
    };
  }
}
