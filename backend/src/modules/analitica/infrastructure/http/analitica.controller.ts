import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { Rol } from '../../../../shared/auth/rol';
import { ResumenAnaliticoUseCase } from '../../application/resumen-analitico.use-case';
import { ConsultarResumenDto } from './dto/resumen.dto';

/**
 * `/v1/analitica` — resumen ejecutivo por rango de fechas (Fase 6).
 *
 * ## RBAC: SOLO `SUPER_ADMIN` Y `ADMINISTRADOR`
 *
 * La `GERENTE` (Encargada) recibe `403`, y la decisión merece explicarse porque es más estricta
 * que el resto del panel, donde ella entra a todo:
 *
 * - **Agrega las tres sucursales.** Es información de negocio del dueño: ingresos, comparativa
 *   entre sucursales y **desempeño por manicurista**. Lo último es lo decisivo: *"cuántas citas
 *   completó cada manicurista"* es una medida del trabajo de sus compañeras, y darla a quien no
 *   decide sobre su contratación es una fuga de un dato sensible sin necesidad operativa.
 * - **No hace falta para operar.** Nada de esta pantalla sirve para atender el día: no hay acción,
 *   solo lectura agregada. La Encargada ya tiene la Agenda y la Bandeja, que es su trabajo.
 *
 * `ADR-024` fija el catálogo cerrado de 7 roles y que la autorización se revalida en el servidor
 * con los permisos resueltos contra PostgreSQL; esta es la aplicación de ese nivel 2.
 *
 * ⚠️ **No se hizo lectura acotada por sucursal para la Encargada**, que era la otra opción que la
 * orden permitía. El motivo: el desglose por manicurista seguiría estando, y acotarlo a su
 * sucursal no quita el problema — en una sucursal de una silla (Álamos), el desglose por
 * manicurista **es** el desempeño de una persona identificable.
 */
@Controller('v1/analitica')
export class AnaliticaController {
  constructor(private readonly resumen: ResumenAnaliticoUseCase) {}

  @Get('resumen')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async obtener(@Query() query: ConsultarResumenDto) {
    return this.resumen.ejecutar({
      rango: { inicio: new Date(query.desde), fin: new Date(query.hasta) },
      ...(query.sucursalId ? { sucursalId: query.sucursalId } : {}),
    });
  }
}
