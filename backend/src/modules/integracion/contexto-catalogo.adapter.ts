import { Inject, Injectable } from '@nestjs/common';
import { ContextoCatalogoPort, ServicioAgendable } from '../agenda/domain/ports/contexto-catalogo.port';
import { SERVICIO_REPOSITORY, ServicioRepository } from '../catalogo-y-cotizacion/domain/ports/servicio.repository';

/**
 * Traduce lo que **Agenda** pregunta a lo que **Catálogo y Cotización** sabe.
 *
 * Es una traducción y no un atajo: la entidad `Servicio` no cruza la frontera. Lo que cruza es un
 * `ServicioAgendable`, con los seis campos que Agenda necesita y ninguno más. Si mañana `Servicio`
 * gana un campo administrativo, Agenda no se enterará — que es justo lo que se quiere.
 */
@Injectable()
export class ContextoCatalogoAdapter implements ContextoCatalogoPort {
  constructor(@Inject(SERVICIO_REPOSITORY) private readonly servicios: ServicioRepository) {}

  async buscarServicio(servicioId: string): Promise<ServicioAgendable | null> {
    const servicio = await this.servicios.buscarPorId(servicioId);
    if (!servicio) return null;

    return {
      id: servicio.id,
      nombre: servicio.nombre,
      categoria: servicio.categoria,
      duracionMinutos: servicio.duracionBaseMinutos,
      precioCentavos: servicio.precioBaseCentavos,
      activo: servicio.activo,
      requiereCotizacionManual: servicio.requiereCotizacionManual,
    };
  }
}
