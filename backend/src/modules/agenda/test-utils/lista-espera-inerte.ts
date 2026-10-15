import { ProcesarListaEsperaUseCase, ResultadoHuecoLiberado } from '../application/use-cases/lista-espera.use-cases';

/**
 * Doble de `ProcesarListaEsperaUseCase` que no hace nada.
 *
 * Lo usan las pruebas del **ciclo de vida de la cita**, que van sobre transiciones de estado y no
 * sobre la fila. Sin él, cada una tendría que montar el repositorio de lista de espera, el motor y
 * el puerto de notificación para probar que `confirmada → completada` funciona — y cualquier
 * cambio en la Lista de Espera las rompería sin que tengan nada que ver.
 *
 * Las pruebas de la fila usan el caso de uso **real** contra PostgreSQL (`lista-espera.spec.ts`).
 */
export function crearProcesarListaEsperaInerte(): ProcesarListaEsperaUseCase {
  const inerte: ResultadoHuecoLiberado = { huecoPerdidoCortoPlazo: false, ofrecida: null, descartadasPorNoCaber: 0 };
  return { procesarHuecoLiberado: async () => inerte } as unknown as ProcesarListaEsperaUseCase;
}
