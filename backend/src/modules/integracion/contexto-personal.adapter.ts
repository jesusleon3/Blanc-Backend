import { Inject, Injectable } from '@nestjs/common';
import { ContextoPersonalPort } from '../agenda/domain/ports/contexto-personal.port';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../sucursales-y-personal/domain/ports/manicurista.repository';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../sucursales-y-personal/domain/ports/sucursal.repository';
import {
  EXCEPCION_PERSONAL_REPOSITORY,
  ExcepcionPersonalRepository,
} from '../sucursales-y-personal/domain/ports/excepcion-personal.repository';
import { HorarioSemanalData } from '../sucursales-y-personal/domain/value-objects/horario-semanal.vo';
import { RangoHorario } from '../../database/schema';

/**
 * Traduce lo que **Agenda** pregunta a lo que **Sucursales y Personal** sabe (`DEC-036`).
 *
 * Aquí es donde se aplica la aritmética de `DEC-036`: asignadas de base **+** coberturas
 * entrantes **−** ausencias **−** coberturas salientes.
 */
@Injectable()
export class ContextoPersonalAdapter implements ContextoPersonalPort {
  constructor(
    @Inject(MANICURISTA_REPOSITORY) private readonly manicuristas: ManicuristaRepository,
    @Inject(SUCURSAL_REPOSITORY) private readonly sucursales: SucursalRepository,
    @Inject(EXCEPCION_PERSONAL_REPOSITORY) private readonly excepciones: ExcepcionPersonalRepository,
  ) {}

  async horarioSemanalDe(sucursalId: string): Promise<HorarioSemanalData | null> {
    const sucursal = await this.sucursales.buscarPorId(sucursalId);
    return sucursal ? sucursal.horarioSemanal.toJSON() : null;
  }

  async manicuristasOperativasEn(sucursalId: string, rango: RangoHorario): Promise<string[]> {
    const activas = (await this.manicuristas.listar()).filter((m) => m.activa);
    const excepciones = await this.excepciones.listarQueSolapan(rango);

    const ausentes = new Set(excepciones.filter((e) => e.tipo === 'ausencia').map((e) => e.manicuristaId));
    const coberturas = excepciones.filter((e) => e.tipo === 'cobertura');
    // Una cobertura es un MOVIMIENTO: quien cubre en otra sucursal deja de estar en la suya.
    const cubriendoFuera = new Set(coberturas.filter((e) => e.sucursalId !== sucursalId).map((e) => e.manicuristaId));
    const cubriendoAqui = new Set(coberturas.filter((e) => e.sucursalId === sucursalId).map((e) => e.manicuristaId));

    const operativas: string[] = [];
    for (const manicurista of activas) {
      if (ausentes.has(manicurista.id)) continue;

      if (cubriendoAqui.has(manicurista.id)) {
        // Viene a cubrir: cuenta aquí aunque no esté asignada de base a esta sucursal.
        operativas.push(manicurista.id);
        continue;
      }
      if (cubriendoFuera.has(manicurista.id)) continue;

      const asignadas = await this.manicuristas.listarSucursalesDeManicurista(manicurista.id);
      if (asignadas.includes(sucursalId)) operativas.push(manicurista.id);
    }

    return operativas;
  }
}
