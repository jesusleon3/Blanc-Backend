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

    // (2) Las que no llevan nombre pero quedan en una sucursal con sobrecupo. Sin esta segunda
    // clase, quitar a una manicurista de una sucursal llena parecería inofensivo solo porque
    // ninguna cita llevaba su nombre — y alguien se quedaría sin atender igual.
    const sucursales = await this.manicuristas.listarSucursalesDeManicurista(manicuristaId);
    const yaIncluidas = new Set(afectadas.map((c) => c.id));

    for (const sucursalId of sucursales) {
      const activas = await this.citas.listarQueOcupanEnRango(sucursalId, rango);
      // Se calcula DESPUÉS de guardar la excepción, así que `deficitDePersonal` ya la refleja.
      const { deficitDePersonal } = await this.motor.calcularCapacidad(sucursalId, rango);
      if (deficitDePersonal === 0) continue;

      // Se reportan TODAS las citas sin asignar de esa sucursal, no solo `deficitDePersonal` de
      // ellas: el déficit dice *cuántas* se van a quedar sin atender, pero no *cuáles*, porque
      // ninguna tiene dueña todavía. Elegir unas al azar daría una precisión que no existe y
      // dejaría fuera citas que la Encargada igual tiene que mirar.
      for (const cita of activas) {
        if (cita.manicuristaId === null && !yaIncluidas.has(cita.id)) {
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
