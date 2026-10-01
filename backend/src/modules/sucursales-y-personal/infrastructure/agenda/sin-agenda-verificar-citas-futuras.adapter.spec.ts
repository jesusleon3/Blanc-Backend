import { SinAgendaVerificarCitasFuturasAdapter } from './sin-agenda-verificar-citas-futuras.adapter';

/**
 * Esta prueba **fija a propósito el comportamiento de un sustituto temporal**, no verifica una
 * funcionalidad deseada.
 *
 * Existe para que, cuando Fase 2 traiga el Bounded Context *Agenda*, sustituir el adaptador rompa
 * esta prueba y obligue a alguien a borrarla conscientemente — en vez de que el sustituto
 * sobreviva en silencio y el bloqueo duro de `DEC-032` quede desactivado sin que nadie lo note.
 */
describe('SinAgendaVerificarCitasFuturasAdapter — sustituto temporal, NO una implementación', () => {
  it('siempre responde `false`: hoy no existe ninguna tabla de citas que consultar', async () => {
    const adaptador = new SinAgendaVerificarCitasFuturasAdapter();

    await expect(adaptador.tieneCitasFuturas('cualquier-id')).resolves.toBe(false);
    await expect(adaptador.tieneCitasFuturas('11111111-1111-1111-1111-111111111111')).resolves.toBe(false);
  });

  it('RECORDATORIO: en cuanto Agenda exista, este adaptador debe BORRARSE, no quedarse de respaldo', async () => {
    // Si este test te molesta, probablemente estés implementando Agenda. Es exactamente el momento
    // de reemplazar el proveedor en `sucursales-y-personal.module.ts` y eliminar ambos archivos.
    const adaptador = new SinAgendaVerificarCitasFuturasAdapter();
    expect(await adaptador.tieneCitasFuturas('id')).toBe(false);
  });
});
