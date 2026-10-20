import { SERVICIOS_DE_BLANC } from '../../../database/seed/catalogo-de-blanc';
import { CODIGOS_DE_SERVICIO, DISENOS_ESTANDAR } from '../../catalogo-y-cotizacion/domain/codigos-de-servicio';
import { CODIGOS_QUE_LA_MATRIZ_RESUELVE, resolverCombinacion } from './resolutor-de-combinaciones';

/**
 * ## LO QUE ESTE ARCHIVO PROTEGE
 *
 * La tabla de la Dueña dice que las duraciones **se absorben, no se suman**. Si el resolutor se
 * equivoca, no hay error: hay una cita del tamaño equivocado. Las dos formas de equivocarse cuestan
 * dinero en direcciones opuestas:
 *
 * - **Pasarse de largo** (mapear *"rubber con gel"* a dos horas) bloquea una silla que podría
 *   venderse.
 * - **Quedarse corto** (mapear *"retiro de acrílico y extensiones"* a dos horas en vez de tres)
 *   mete una cita encima de otra: la clienta llega y la silla está ocupada.
 *
 * Por eso cada caso de abajo fija la combinación **y el bloque** que le corresponde.
 */
describe('`resolverCombinacion` — la matriz oficial de la Dueña', () => {
  /** Atajo legible: devuelve el **código** del servicio resuelto, o el motivo de escalamiento. */
  const resolver = (texto: string) => {
    const resultado = resolverCombinacion(texto);
    return resultado === null ? null : 'codigo' in resultado ? resultado.codigo : `ESCALA:${resultado.escalar}`;
  };

  describe('servicios individuales — todo cabe en una hora', () => {
    it.each([
      ['quiero gel', 'GEL'],
      ['me pongo rubber', 'RUBBER'],
      ['solo manicure por favor', 'MANICURE'],
      ['rubber con gel', 'RUBBER-GEL'],
      // El caso que la orden nombra explícitamente: tres trabajos, UNA hora.
      ['rubber con gel y manicure', 'RUBBER-GEL-MANICURE'],
      ['quiero manicure, rubber y gel', 'RUBBER-GEL-MANICURE'],
    ])('«%s» → %s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });
  });

  describe('extensiones y cobertura — dos horas', () => {
    it.each([
      ['quiero extensiones', 'EXT'],
      ['un baño de acrilico', 'BANO'],
      ['extensiones con gel', 'EXT-GEL'],
      ['baño de acrílico con gel', 'BANO-GEL'],
      ['extensiones con gel y manicure', 'EXT-GEL-MANICURE'],
      ['baño de acrilico con gel y manicure', 'BANO-GEL-MANICURE'],
    ])('«%s» → %s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });
  });

  describe('combinaciones con retiro — aquí está la trampa de la tabla', () => {
    /**
     * ## CADA COMBINACIÓN TIENE SU PROPIO CÓDIGO DESDE EL DESGLOSE (2026-10-21)
     *
     * Antes, las tres variantes de *retiro de gel + algo* resolvían al **mismo** renglón agrupado.
     * Para el tiempo era exacto —las tres son una hora— pero compartían precio, y no había forma de
     * separarlas desde `/admin`. Ahora cada una es su propia fila con su propio importe, y estas
     * pruebas fijan que el resolutor las distingue.
     */
    it.each([
      // El retiro de GEL se absorbe: una hora, y un código por destino.
      ['retiro de gel con gel', 'RGEL-GEL'],
      ['quiero retiro de gel con rubber', 'RGEL-RUBBER'],
      ['retiro de gel y manicure', 'RGEL-MANICURE'],
      ['retiro de gel con rubber y gel', 'RGEL-RUBBER-GEL'],
      ['retiro de gel con rubber, gel y manicure', 'RGEL-RUBBER-GEL-MANICURE'],
      // El retiro de ACRÍLICO no se absorbe: dos horas, mismo desglose por destino.
      ['retiro de acrilico con gel', 'RACR-GEL'],
      ['retiro de rubber con rubber', 'RACR-RUBBER'],
      ['retiro de acrilico y manicure', 'RACR-MANICURE'],
      ['retiro de acrilico con rubber y gel', 'RACR-RUBBER-GEL'],
      ['retiro de acrilico con rubber, gel y manicure', 'RACR-RUBBER-GEL-MANICURE'],
      // Y con extensiones o baño, el bloque de tres horas — ahora separados, porque no cuestan igual.
      ['retiro de acrílico y extensiones', 'RACR-EXT'],
      ['quitarme el acrilico y baño de acrilico', 'RACR-BANO'],
      ['retiro de acrílico con extensiones y manicure', 'RACR-EXT-MANICURE'],
      ['retiro de acrílico y baño de acrílico con manicure', 'RACR-BANO-MANICURE'],
    ])('«%s» → %s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });

    it('DISTINGUE el destino, que es lo que el desglose vino a arreglar', () => {
      /**
       * La prueba de fondo del desglose: las tres resuelven a **códigos distintos** aunque las tres
       * duren lo mismo. Mientras compartían renglón, darle a *retiro + gel* un precio distinto del
       * de *retiro + manicure* era imposible.
       */
      const codigos = ['retiro de gel con gel', 'retiro de gel con rubber', 'retiro de gel con manicure'].map(resolver);

      expect(new Set(codigos).size).toBe(3);
    });

    it('un retiro A SECAS es su propio servicio, no una combinación', () => {
      expect(resolver('solo quiero retiro')).toBe('RETIRO');
      expect(resolver('nada mas retirarme el acrilico')).toBe('RETIRO');
    });
  });

  describe('diseños estándar (`DEC-033`) — los tres que el bot SÍ agenda', () => {
    it.each([
      ['quiero gel con frances', 'GEL-DISENO'],
      ['gel con francés', 'GEL-DISENO'],
      ['rubber con ojo de gato', 'RUBBER-DISENO'],
      ['rubber con puntos', 'RUBBER-DISENO'],
      ['rubber con polka dots', 'RUBBER-DISENO'],
      ['manicure y rubber con frances', 'MANICURE-RUBBER-DISENO'],
      // Sobre extensiones el diseño NO se absorbe: 120 + 60. Y extensiones y baño van separados
      // desde el desglose, porque no cuestan lo mismo.
      ['extensiones con ojo de gato', 'EXT-DISENO'],
      ['baño de acrílico con frances', 'BANO-DISENO'],
    ])('«%s» → %s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });

    it('los tres diseños estándar del catálogo están todos reconocidos', () => {
      // Si alguien añade un cuarto a `DISENOS_ESTANDAR` sin enseñárselo al resolutor, esto falla:
      // la constante es el registro oficial y el resolutor tiene que saber leerla entera.
      for (const diseno of DISENOS_ESTANDAR) {
        const palabra = diseno.toLowerCase().split(' / ')[0]!;
        expect(resolver(`gel con ${palabra}`)).toBe('GEL-DISENO');
      }
    });
  });

  describe('diseños COMPLEJOS — escalan a una persona, nunca se agendan solos', () => {
    it.each([
      'quiero un diseño de mano alzada',
      'me gustaria unas figuras en las uñas',
      'quiero uñas 3d',
      'gel con encapsulado',
      'vi un diseño en instagram que quiero',
      'quiero un diseño personalizado',
      // Pedir "diseño" sin decir cuál tampoco se adivina: podría ser cualquiera de los dos mundos.
      'quiero gel con diseño',
    ])('«%s» escala con `cotizacion_compleja`', (texto) => {
      expect(resolver(texto)).toBe('ESCALA:cotizacion_compleja');
    });

    it('un diseño complejo escala AUNQUE la combinación base sea válida', () => {
      /**
       * Es la decisión que importa: *"retiro de acrílico, extensiones y un diseño de Instagram"* es
       * una combinación que el resolutor sabría mapear a tres horas. Y aun así escala, porque el
       * **precio** del diseño lo fija una persona (`DEC-033`) y el tiempo probablemente tampoco
       * alcance. Mapearla sería agendar un diseño complejo a precio de combinación estándar.
       */
      expect(resolver('retiro de acrílico con extensiones y un diseño en 3d')).toBe('ESCALA:cotizacion_compleja');
    });
  });

  describe('lo que NO resuelve devuelve `null`, y eso escala por el camino de siempre', () => {
    it.each([
      // Nada reconocible.
      'hola, buenos dias',
      '¿cuanto cuesta?',
      // Un servicio que el catálogo de Blanc no tiene.
      'quiero pedicure',
      'depilacion de cejas',
      // Una combinación que la tabla de la Dueña NO contempla: no se inventa el bloque.
      'extensiones con rubber',
      'retiro de gel con extensiones',
    ])('«%s» → null', (texto) => {
      expect(resolver(texto)).toBeNull();
    });

    it('NO inventa una combinación sumando piezas que la tabla no junta', () => {
      /**
       * La prueba de fondo del archivo. *"Extensiones con rubber"* son dos cosas que existen por
       * separado, y la tabla **no dice** cuánto tardan juntas. Devolver 120 (el de extensiones) o
       * 180 (sumando) serían dos invenciones distintas. Se devuelve `null`, el turno escala, y una
       * persona decide — que es lo que `RN-COT-01` exige cuando no hay fila.
       */
      expect(resolver('extensiones con rubber')).toBeNull();
      expect(resolver('manicure con extensiones')).toBeNull();
    });
  });

  describe('robustez del texto real de WhatsApp', () => {
    it.each([
      ['MAYÚSCULAS Y ACENTOS: RUBBER CON GEL Y MANICURE', 'RUBBER-GEL-MANICURE'],
      ['sin acentos: bano de acrilico con gel', 'BANO-GEL'],
      ['con relleno: hola, me gustaria agendar rubber con gel por favor', 'RUBBER-GEL'],
      ['plural y diminutivo: quiero extensiones con gelito', 'EXT-GEL'],
    ])('%s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });
  });

  describe('la matriz, los códigos y el catálogo no pueden separarse', () => {
    /**
     * ## POR QUÉ ESTAS TRES PRUEBAS VALEN MÁS QUE CUALQUIER CASO INDIVIDUAL
     *
     * El vínculo entre lo que la clienta dice y lo que se agenda pasa por tres piezas que viven en
     * archivos distintos: la **matriz** (texto → código), la **lista de códigos** (el vocabulario) y
     * el **catálogo sembrado** (código → nombre, duración, precio). `tsc` ya garantiza que la matriz
     * no inventa códigos, porque el tipo es una unión de literales.
     *
     * Lo que `tsc` **no** puede ver es si un código existe en el vocabulario pero nadie lo siembra:
     * la matriz resolvería a una fila que no está en la base, el bot escalaría una combinación que
     * la Dueña sí ofrece, y **nada fallaría al compilar ni al correr las pruebas de la matriz**. Eso
     * es lo que se cubre aquí.
     */
    it('TODO código que la matriz resuelve está en el catálogo oficial', () => {
      const sembrados = new Set(SERVICIOS_DE_BLANC.map((servicio) => servicio.codigo));
      const huerfanos = CODIGOS_QUE_LA_MATRIZ_RESUELVE.filter((codigo) => !sembrados.has(codigo));

      expect(huerfanos).toEqual([]);
    });

    it('TODO código sembrado está en el vocabulario, y no hay duplicados', () => {
      const codigos = SERVICIOS_DE_BLANC.map((servicio) => servicio.codigo);

      expect(new Set(codigos).size).toBe(codigos.length);
      expect(codigos.filter((codigo) => !CODIGOS_DE_SERVICIO.includes(codigo))).toEqual([]);
    });

    it('la ÚNICA fila que la matriz nunca resuelve es la de cotización manual', () => {
      /**
       * `DISENO-ESPECIAL` existe para el mostrador, no para el bot: cuando escala un diseño
       * complejo, alguien tiene que poder agendarlo con un precio que fije una persona. Que el bot
       * **no** pueda llegar a ella es la regla de `DEC-033` funcionando, no un hueco.
       *
       * Si alguna vez apareciera otra fila sin entrada en la matriz, esta prueba lo diría — y sería
       * una combinación que la Dueña ofrece y el bot no sabe vender.
       */
      const sinEntradaEnLaMatriz = SERVICIOS_DE_BLANC.map((servicio) => servicio.codigo).filter(
        (codigo) => !CODIGOS_QUE_LA_MATRIZ_RESUELVE.includes(codigo),
      );

      expect(sinEntradaEnLaMatriz).toEqual(['DISENO-ESPECIAL']);
    });
  });
});