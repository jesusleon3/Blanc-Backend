import { DISENOS_ESTANDAR } from '../../../database/seed/catalogo-de-blanc';
import { resolverCombinacion } from './resolutor-de-combinaciones';

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
  /** Atajo legible: devuelve el nombre del servicio resuelto, o el motivo de escalamiento. */
  const resolver = (texto: string) => {
    const resultado = resolverCombinacion(texto);
    return resultado === null ? null : 'servicio' in resultado ? resultado.servicio : `ESCALA:${resultado.escalar}`;
  };

  describe('servicios individuales — todo cabe en una hora', () => {
    it.each([
      ['quiero gel', 'Gel'],
      ['me pongo rubber', 'Rubber'],
      ['solo manicure por favor', 'Manicure'],
      ['rubber con gel', 'Rubber + gel'],
      // El caso que la orden nombra explícitamente: tres trabajos, UNA hora.
      ['rubber con gel y manicure', 'Rubber + gel + manicure'],
      ['quiero manicure, rubber y gel', 'Rubber + gel + manicure'],
    ])('«%s» → %s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });
  });

  describe('extensiones y cobertura — dos horas', () => {
    it.each([
      ['quiero extensiones', 'Extensiones'],
      ['un baño de acrilico', 'Baño de acrílico'],
      ['extensiones con gel', 'Extensiones + gel'],
      ['baño de acrílico con gel', 'Baño de acrílico + gel'],
      ['extensiones con gel y manicure', 'Extensiones + gel + manicure'],
      ['baño de acrilico con gel y manicure', 'Baño de acrílico + gel + manicure'],
    ])('«%s» → %s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });
  });

  describe('combinaciones con retiro — aquí está la trampa de la tabla', () => {
    it.each([
      // El retiro de GEL se absorbe: una hora.
      ['retiro de gel y manicure', 'Retiro de gel + rubber, gel o manicure'],
      ['quiero retiro de gel con rubber', 'Retiro de gel + rubber, gel o manicure'],
      // El retiro de ACRÍLICO no se absorbe: dos horas.
      ['retiro de acrilico y manicure', 'Retiro de acrílico o rubber + rubber, gel o manicure'],
      ['retiro de rubber con gel', 'Retiro de acrílico o rubber + rubber, gel o manicure'],
      // Y con extensiones, el bloque de tres horas.
      ['retiro de acrílico y extensiones', 'Retiro de acrílico o rubber + extensiones o baño de acrílico'],
      ['quitarme el acrilico y baño de acrilico', 'Retiro de acrílico o rubber + extensiones o baño de acrílico'],
      // El manicure se absorbe dentro de las tres horas: es el caso que la orden nombra.
      [
        'retiro de acrílico y baño de acrílico con manicure',
        'Retiro de acrílico o rubber + extensiones o baño de acrílico + manicure',
      ],
    ])('«%s» → %s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });

    it('un retiro A SECAS es su propio servicio, no una combinación', () => {
      expect(resolver('solo quiero retiro')).toBe('Retiro de gel, acrílico o rubber');
      expect(resolver('nada mas retirarme el acrilico')).toBe('Retiro de gel, acrílico o rubber');
    });
  });

  describe('diseños estándar (`DEC-033`) — los tres que el bot SÍ agenda', () => {
    it.each([
      ['quiero gel con frances', 'Gel + diseño estándar'],
      ['gel con francés', 'Gel + diseño estándar'],
      ['rubber con ojo de gato', 'Rubber + diseño estándar'],
      ['rubber con puntos', 'Rubber + diseño estándar'],
      ['rubber con polka dots', 'Rubber + diseño estándar'],
      ['manicure y rubber con frances', 'Manicure + rubber + diseño estándar'],
      // Sobre extensiones el diseño NO se absorbe: 120 + 60.
      ['extensiones con ojo de gato', 'Extensiones o baño de acrílico + diseño estándar'],
      ['baño de acrílico con frances', 'Extensiones o baño de acrílico + diseño estándar'],
    ])('«%s» → %s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });

    it('los tres diseños estándar del catálogo están todos reconocidos', () => {
      // Si alguien añade un cuarto a `DISENOS_ESTANDAR` sin enseñárselo al resolutor, esto falla:
      // la constante es el registro oficial y el resolutor tiene que saber leerla entera.
      for (const diseno of DISENOS_ESTANDAR) {
        const palabra = diseno.toLowerCase().split(' / ')[0]!;
        expect(resolver(`gel con ${palabra}`)).toBe('Gel + diseño estándar');
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
      ['MAYÚSCULAS Y ACENTOS: RUBBER CON GEL Y MANICURE', 'Rubber + gel + manicure'],
      ['sin acentos: bano de acrilico con gel', 'Baño de acrílico + gel'],
      ['con relleno: hola, me gustaria agendar rubber con gel por favor', 'Rubber + gel'],
      ['plural y diminutivo: quiero extensiones con gelito', 'Extensiones + gel'],
    ])('%s', (texto, esperado) => {
      expect(resolver(texto)).toBe(esperado);
    });
  });
});
