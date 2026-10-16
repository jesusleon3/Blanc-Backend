import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Detector de la familia de defectos *"un `@Global` no sobrescribe un proveedor local"*.
 *
 * ## EL DEFECTO QUE ESTO VIGILA OCURRIÓ DE VERDAD, DOS VECES
 *
 * `IntegracionModule` y `AgenteModule` son `@Global` y proveen puertos que **declaran** otros
 * Bounded Contexts. El patrón funciona, con una condición que no es evidente: **el BC que declara
 * el puerto no puede proveer también un valor por defecto para él**. Si lo hace, su proveedor
 * local gana y el global no se usa nunca — `@Global` solo evita tener que importar el módulo, no
 * da prioridad sobre nada.
 *
 * Pasó dos veces, y las dos silenciosamente:
 *
 * 1. **Fase 4 Parte 2.** `AgendaModule` proveía los adaptadores de solo-log de recordatorios y de
 *    lista de espera, e `IntegracionModule` creía sustituirlos por el que manda plantillas de
 *    WhatsApp. El canal quedó construido y conectado, y **no salió ni un mensaje**, con toda la
 *    suite en verde. Se reportó como terminado.
 * 2. **Fase 4 Parte 3.** `ConversacionesModule` proveía el orquestador inerte y `AgenteModule`
 *    creía sustituirlo por el bot real. El bot quedó inerte. Lo destapó `bot.e2e.spec.ts` al
 *    montar el grafo completo de módulos, que es el único sitio donde se puede ver.
 *
 * ## POR QUÉ ES UNA PRUEBA DE TEXTO Y NO DE CONTENEDOR
 *
 * Levantar el contenedor y preguntar qué instancia recibió cada consumidor solo detecta el caso en
 * el grafo que esa prueba monte, y el defecto vive precisamente en las combinaciones que nadie
 * monta. Leer los módulos es exacto para lo que se quiere afirmar: **que la declaración duplicada
 * no existe**, en ninguna composición posible.
 *
 * Mismo criterio que los detectores de deriva de `CHECK`: lo que no se puede expresar en el tipo
 * se vigila comparando el texto contra la lista de lo que debe cumplirse.
 */
describe('Ningún Bounded Context declara un valor por defecto para un puerto que otro módulo provee', () => {
  const leer = (ruta: string) => readFileSync(join(__dirname, '..', '..', ruta), 'utf8');

  /** Los puertos que un módulo `@Global` provee, y el módulo que NO debe declararlos. */
  const PUERTOS_PROVISTOS_POR_FUERA: { puerto: string; moduloQueLoDeclara: string; proveedor: string }[] = [
    // Provistos por `IntegracionModule`.
    { puerto: 'NOTIFICADOR_RECORDATORIO_PORT', moduloQueLoDeclara: 'modules/agenda/agenda.module.ts', proveedor: 'IntegracionModule' },
    { puerto: 'NOTIFICACION_LISTA_ESPERA_PORT', moduloQueLoDeclara: 'modules/agenda/agenda.module.ts', proveedor: 'IntegracionModule' },
    { puerto: 'CONTEXTO_PERSONAL_PORT', moduloQueLoDeclara: 'modules/agenda/agenda.module.ts', proveedor: 'IntegracionModule' },
    { puerto: 'CONTEXTO_CATALOGO_PORT', moduloQueLoDeclara: 'modules/agenda/agenda.module.ts', proveedor: 'IntegracionModule' },
    { puerto: 'CONTEXTO_CLIENTA_PORT', moduloQueLoDeclara: 'modules/agenda/agenda.module.ts', proveedor: 'IntegracionModule' },
    { puerto: 'ANTICIPO_PORT', moduloQueLoDeclara: 'modules/agenda/agenda.module.ts', proveedor: 'IntegracionModule' },
    {
      puerto: 'CONTEXTO_CLIENTA_DE_CONVERSACION_PORT',
      moduloQueLoDeclara: 'modules/conversaciones/conversaciones.module.ts',
      proveedor: 'IntegracionModule',
    },
    {
      puerto: 'TRANSICION_DE_CITA_PORT',
      moduloQueLoDeclara: 'modules/anticipos/anticipos.module.ts',
      proveedor: 'IntegracionModule',
    },
    // Provisto por `AgenteModule`.
    {
      puerto: 'ORQUESTADOR_DE_BOT_PORT',
      moduloQueLoDeclara: 'modules/conversaciones/conversaciones.module.ts',
      proveedor: 'AgenteModule',
    },
  ];

  it.each(PUERTOS_PROVISTOS_POR_FUERA)(
    '`$moduloQueLoDeclara` NO declara un proveedor de `$puerto` (lo provee $proveedor)',
    ({ puerto, moduloQueLoDeclara }) => {
      const texto = leer(moduloQueLoDeclara);

      // Lo que se busca es la forma `{ provide: EL_PUERTO, ... }`. Mencionarlo en un comentario
      // —como hacen las notas que explican por qué NO está— es legítimo y no debe fallar.
      const declaraProveedor = new RegExp(String.raw`provide:\s*${puerto}\b`).test(texto);

      expect(declaraProveedor).toBe(false);
    },
  );

  it.each(PUERTOS_PROVISTOS_POR_FUERA)('$proveedor SÍ provee `$puerto`', ({ puerto, proveedor }) => {
    // La otra mitad del invariante: si nadie lo provee, la aplicación no arranca. Es un fallo
    // ruidoso y no silencioso, pero conviene que esta prueba lo diga antes que el arranque.
    const ruta = proveedor === 'IntegracionModule' ? 'modules/integracion/integracion.module.ts' : 'modules/agente/agente.module.ts';
    expect(new RegExp(String.raw`provide:\s*${puerto}\b`).test(leer(ruta))).toBe(true);
  });

  it('el adaptador de solo-log de recordatorios SIGUE EXISTIENDO pero NADIE lo registra', () => {
    /**
     * No se borra: documenta el comportamiento provisional y sirve si hay que apagar los envíos.
     * Lo que no puede volver a pasar es que esté **registrado** en un módulo, porque entonces gana
     * sobre el adaptador real de WhatsApp. Esta prueba separa las dos cosas.
     */
    const modulos = ['modules/agenda/agenda.module.ts', 'modules/integracion/integracion.module.ts'];
    for (const modulo of modulos) {
      const texto = leer(modulo);
      expect(/useClass:\s*RecordatorioSoloLogAdapter/.test(texto)).toBe(false);
      expect(/useClass:\s*ListaEsperaSoloLogAdapter/.test(texto)).toBe(false);
    }
  });
});
