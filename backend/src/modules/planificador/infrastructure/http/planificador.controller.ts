import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsISO8601 } from 'class-validator';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { NombreDeBarrido, PlanificadorService } from '../../application/planificador.service';

const BARRIDOS: NombreDeBarrido[] = ['lista_espera', 'anticipos', 'cierre_de_citas', 'recordatorios'];

export class DispararBarridoDto {
  /**
   * Instante de referencia. **Solo para operación y diagnóstico**, no para alterar la realidad:
   * permite a la Dueña reproducir qué habría barrido el planificador en un momento dado.
   *
   * No abre ningún agujero: los casos de uso seleccionan por estado, así que un `ahora` adelantado
   * como mucho procesa antes algo que iba a procesarse igual. No puede, por ejemplo, cerrar una
   * cita futura, porque la consulta exige que su horario haya terminado *respecto a ese instante*.
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  ahora?: string;
}

export class NombreDeBarridoDto {
  @IsIn(BARRIDOS)
  nombre!: NombreDeBarrido;
}

/**
 * `/v1/planificador` — disparo manual y estado de los barridos (`ADR-025`).
 *
 * ## POR QUÉ EXISTE ESTE CONTROLADOR SI YA HAY CRON
 *
 * Tres razones concretas, no simetría:
 *
 * 1. **El canal de WhatsApp no existe todavía.** Mientras los avisos se dan por teléfono, la
 *    Encargada necesita poder decir *"avanza la fila ahora"* en vez de esperar cinco minutos.
 * 2. **Si el proceso estuvo caído**, al volver hay trabajo atrasado y no hay por qué esperar al
 *    siguiente tick.
 * 3. **Es la vía de migración a un cron externo**: el día que se decida sacar el planificador del
 *    proceso (Railway cron, un worker), estos endpoints ya son el punto de entrada. No habría que
 *    reescribir nada.
 *
 * **RBAC: solo `SUPER_ADMIN` y `ADMINISTRADOR`.** Más estrecho que el resto de la operación
 * diaria, y a propósito: un barrido actúa sobre **toda la plataforma a la vez** —cierra citas de
 * las tres sucursales, expira anticipos, mueve la fila— así que no es una acción de turno. La
 * `GERENTE` opera su sucursal; esto no tiene alcance de sucursal que respetar.
 */
@Controller('v1/planificador')
export class PlanificadorController {
  constructor(private readonly planificador: PlanificadorService) {}

  /** Qué barridos existen y si el cron está activo. Útil para saber si hay que dispararlos a mano. */
  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  estado() {
    return { barridos: BARRIDOS, cronActivo: this.planificador.estaActivo };
  }

  @Post('barridos/:nombre')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(200)
  async disparar(@Param() params: NombreDeBarridoDto, @Body() dto: DispararBarridoDto, @CurrentUser() usuario: ClaimsUsuario) {
    const ahora = dto.ahora === undefined ? new Date() : new Date(dto.ahora);
    const resumen = await this.planificador.ejecutarBarrido(params.nombre, usuario, ahora);

    return { barrido: params.nombre, ...resumen };
  }
}
