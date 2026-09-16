import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

/**
 * `GET /health` — sonda de vida (*liveness*) para el balanceador de Railway (`ADR-012`).
 *
 * **Deliberadamente sin dependencias.** No inyecta la conexión a base de datos ni consulta nada:
 * responde si el proceso está vivo y el servidor HTTP acepta peticiones, nada más. Mezclar aquí
 * una comprobación de PostgreSQL convertiría una caída momentánea de la base en un reinicio del
 * contenedor por parte de la plataforma — justo cuando el proceso seguía sano y la base se estaba
 * recuperando sola. Una sonda de *readiness* con dependencias reales, si llega a hacer falta,
 * sería un endpoint distinto, no este.
 *
 * `@Public()` es obligatorio: `JwtAuthGuard` está registrado como `APP_GUARD` global, así que sin
 * el decorador Railway recibiría `401` y marcaría el servicio como caído de forma permanente.
 * `RolesGuard` no exige nada al no haber metadata de `@Roles`.
 *
 * **No expone versión, commit, uptime ni estado interno**: es un endpoint sin autenticación
 * alcanzable desde internet, y no hay razón de negocio para filtrar nada por él.
 */
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  verificar(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
