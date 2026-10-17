import { Cita, TRANSICIONES_LEGALES } from './cita.entity';
import { ESTADOS_CITA, EstadoCita } from '../../../../database/schema';
import { Silla } from './silla.entity';
import { DomainError } from '../../../../shared/errors/domain-error';

const BASE = {
  sucursalId: '11111111-1111-1111-1111-111111111111',
  sillaId: '22222222-2222-2222-2222-222222222222',
  clientaId: '33333333-3333-3333-3333-333333333333',
  servicioId: '44444444-4444-4444-4444-444444444444',
  rangoHorario: { inicio: new Date('2026-11-02T10:00:00Z'), fin: new Date('2026-11-02T11:00:00Z') },
};

/**
 * Construye una cita YA en el estado pedido, sin recorrer el camino legal. Usa `reconstruir`
 * —la puerta de la persistencia, que por diseño no valida transiciones— precisamente porque estas
 * pruebas necesitan partir de cualquier estado para probar la matriz completa.
 */
function enEstado(estado: EstadoCita): Cita {
  const base = Cita.crear(BASE);
  return Cita.reconstruir({
    id: base.id,
    sucursalId: base.sucursalId,
    sillaId: base.sillaId,
    manicuristaId: base.manicuristaId,
    clientaId: base.clientaId,
    servicioId: base.servicioId,
    rangoHorario: base.rangoHorario,
    estado,
    citaOrigenId: null,
    esGarantia: false,
    citaGarantizadaId: null,
    numeroDeReprogramaciones: 0,
    cotizacionSnapshot: null,
  });
}

describe('Cita — aggregate raíz de Agenda', () => {
  it('nace `agendada` y sin manicurista: "sin preferencia" es el caso normal, no un dato faltante', () => {
    const cita = Cita.crear(BASE);

    expect(cita.estado).toBe('agendada');
    expect(cita.manicuristaId).toBeNull();
    expect(cita.sillaId).toBe(BASE.sillaId);
  });

  describe('validación del rango', () => {
    it('rechaza un fin anterior al inicio', () => {
      const invertido = { inicio: new Date('2026-11-02T11:00:00Z'), fin: new Date('2026-11-02T10:00:00Z') };
      expect(() => Cita.crear({ ...BASE, rangoHorario: invertido })).toThrow(expect.objectContaining({ code: 'CITA_RANGO_INVALIDO' }));
    });

    it('rechaza un rango de duración cero', () => {
      const instante = new Date('2026-11-02T10:00:00Z');
      expect(() => Cita.crear({ ...BASE, rangoHorario: { inicio: instante, fin: instante } })).toThrow(DomainError);
    });

    it('rechaza una fecha inválida', () => {
      const roto = { inicio: new Date('no-es-fecha'), fin: new Date('2026-11-02T11:00:00Z') };
      expect(() => Cita.crear({ ...BASE, rangoHorario: roto })).toThrow(DomainError);
    });
  });

  describe('`ocupaHorario` — la lista de DEC-034, corregida por RN-ANT-03', () => {
    it.each(['agendada', 'pendiente_confirmacion', 'confirmada', 'completada', 'no_show'] as const)('`%s` OCUPA el horario', (estado) => {
      expect(enEstado(estado).ocupaHorario).toBe(true);
    });

    it.each(['cancelada', 'expirada', 'reprogramada'] as const)('`%s` LIBERA el horario', (estado) => {
      expect(enEstado(estado).ocupaHorario).toBe(false);
    });

    it('`en_espera_pago` LIBERA — corregido: `DEC-034` lo daba por ocupante y contradecía a `RN-ANT-03`', () => {
      // "no existe una retención temporal real del horario… el primero en pagar se queda con el
      // cupo". Si ocupara, esa carrera no podría existir.
      expect(enEstado('en_espera_pago').ocupaHorario).toBe(false);
    });
  });

  describe('Máquina de estados formal — cierre de P3', () => {
    it('rechaza un estado que no existe', () => {
      expect(() => Cita.crear(BASE).cambiarEstado('inventado' as never)).toThrow(
        expect.objectContaining({ code: 'CITA_ESTADO_INVALIDO' }),
      );
    });

    describe('matriz completa: cada par (desde, hacia) se comporta según la tabla', () => {
      const TODOS = ESTADOS_CITA;

      it.each(TODOS.flatMap((desde) => TODOS.map((hacia) => [desde, hacia] as const)))(
        '%s -> %s',
        (desde, hacia) => {
          const cita = enEstado(desde);
          const esLegal = (TRANSICIONES_LEGALES[desde] as readonly string[]).includes(hacia);

          if (esLegal) {
            cita.cambiarEstado(hacia);
            expect(cita.estado).toBe(hacia);
          } else {
            expect(() => cita.cambiarEstado(hacia)).toThrow(expect.objectContaining({ code: 'TRANSICION_ESTADO_INVALIDA' }));
            // Y el estado no se movió a medias.
            expect(cita.estado).toBe(desde);
          }
        },
      );
    });

    describe('flujo normal', () => {
      it('agendada -> pendiente_confirmacion -> confirmada -> completada', () => {
        const cita = Cita.crear(BASE);
        for (const estado of ['pendiente_confirmacion', 'confirmada', 'completada'] as const) {
          cita.cambiarEstado(estado);
        }
        expect(cita.estado).toBe('completada');
      });

      it.each(['agendada', 'pendiente_confirmacion'] as const)(
        'desde `%s` se puede cerrar DIRECTO a completada o no_show: llegó la hora sin confirmar',
        (desde) => {
          expect(() => enEstado(desde).cambiarEstado('completada')).not.toThrow();
          expect(() => enEstado(desde).cambiarEstado('no_show')).not.toThrow();
        },
      );

      it('`agendada -> confirmada` NO es legal: la confirmación responde a un recordatorio (RN-CONV-11)', () => {
        expect(() => Cita.crear(BASE).cambiarEstado('confirmada')).toThrow(
          expect.objectContaining({ code: 'TRANSICION_ESTADO_INVALIDA' }),
        );
      });
    });

    describe('flujo de anticipo (lista roja)', () => {
      it('en_espera_pago -> agendada / confirmada al confirmar el pago, o -> expirada', () => {
        for (const destino of ['agendada', 'confirmada', 'expirada'] as const) {
          expect(() => enEstado('en_espera_pago').cambiarEstado(destino)).not.toThrow();
        }
      });

      it('`agendada -> en_espera_pago` NO es legal: la lista roja no aplica retroactivamente (RN-CRM-07)', () => {
        expect(() => Cita.crear(BASE).cambiarEstado('en_espera_pago')).toThrow(
          expect.objectContaining({ code: 'TRANSICION_ESTADO_INVALIDA' }),
        );
      });
    });

    describe('salida y terminales', () => {
      it.each(['agendada', 'pendiente_confirmacion', 'confirmada', 'en_espera_pago'] as const)(
        'desde `%s` se puede cancelar y reprogramar',
        (desde) => {
          expect(() => enEstado(desde).cambiarEstado('cancelada')).not.toThrow();
          expect(() => enEstado(desde).cambiarEstado('reprogramada')).not.toThrow();
        },
      );

      it.each(['no_show', 'cancelada', 'expirada', 'reprogramada'] as const)('`%s` es terminal', (estado) => {
        const cita = enEstado(estado);
        expect(cita.esTerminal).toBe(true);

        for (const destino of ESTADOS_CITA) {
          expect(() => cita.cambiarEstado(destino)).toThrow(expect.objectContaining({ code: 'TRANSICION_ESTADO_INVALIDA' }));
        }
      });

      it('`completada` NO es terminal: admite la corrección a `no_show` (N-02)', () => {
        const cita = enEstado('completada');
        expect(cita.esTerminal).toBe(false);

        // `completada` la pone un job por paso del tiempo; la Encargada puede descubrir el no-show
        // horas después. Sin esta salida, ese caso sería incorregible.
        cita.cambiarEstado('no_show');
        expect(cita.estado).toBe('no_show');
      });

      it('pero `completada` solo admite ESA salida: no vuelve a estados activos', () => {
        for (const destino of ['agendada', 'pendiente_confirmacion', 'confirmada', 'cancelada'] as const) {
          expect(() => enEstado('completada').cambiarEstado(destino)).toThrow(
            expect.objectContaining({ code: 'TRANSICION_ESTADO_INVALIDA' }),
          );
        }
      });

      it('el mensaje de un terminal explica que ya no se mueve, en vez de listar destinos vacíos', () => {
        expect(() => enEstado('cancelada').cambiarEstado('confirmada')).toThrow(/terminal/i);
      });
    });
  });

  describe('estado inicial', () => {
    it('por defecto nace `agendada`', () => {
      expect(Cita.crear(BASE).estado).toBe('agendada');
    });

    it('puede nacer `en_espera_pago` — es el camino de lista roja (RN-ANT-01)', () => {
      expect(Cita.crear({ ...BASE, estado: 'en_espera_pago' }).estado).toBe('en_espera_pago');
    });

    it.each(['confirmada', 'completada', 'cancelada', 'reprogramada'] as const)('NO puede nacer `%s`', (estado) => {
      expect(() => Cita.crear({ ...BASE, estado })).toThrow(expect.objectContaining({ code: 'CITA_ESTADO_INICIAL_INVALIDO' }));
    });
  });

  describe('coherencia de garantía (`RN-GAR-01..06`)', () => {
    /**
     * ## POR QUÉ ESTO SE VALIDA EN LA ENTIDAD AUNQUE LA BASE YA LO IMPONGA
     *
     * La migración `0016` lleva un `CHECK` (`citas_garantia_coherente`) que es la autoridad. Pero
     * su SQLSTATE es `23514`, y `HttpExceptionFilter` solo traduce `23505` y `23P01`: una cita
     * incoherente construida por error salía como **500 ERROR_INESPERADO**, sin decir qué faltaba.
     *
     * La entidad no puede *reemplazar* al `CHECK` —dos procesos, una sola autoridad— pero sí puede
     * impedir construir el estado ilegal, que es su trabajo como aggregate.
     */
    it('`esGarantia` sin la cita que honra es un estado ilegal', () => {
      expect(() => Cita.crear({ ...BASE, esGarantia: true })).toThrow(
        expect.objectContaining({ code: 'CITA_GARANTIA_INCOHERENTE' }),
      );
    });

    it('apuntar a una cita garantizada sin ser garantía también lo es', () => {
      expect(() => Cita.crear({ ...BASE, citaGarantizadaId: '66666666-6666-4666-8666-666666666666' })).toThrow(
        expect.objectContaining({ code: 'CITA_GARANTIA_INCOHERENTE' }),
      );
    });

    it('las dos juntas son legítimas, y las dos ausentes son el caso normal', () => {
      expect(Cita.crear({ ...BASE, esGarantia: true, citaGarantizadaId: '66666666-6666-4666-8666-666666666666' }).esGarantia).toBe(true);
      expect(Cita.crear(BASE).esGarantia).toBe(false);
    });

    it('`reconstruir` NO revalida: una fila ya persistida se lee tal cual', () => {
      /**
       * Deliberado. `reconstruir` es el camino de vuelta desde la base, y la base ya tiene su
       * `CHECK`: volver a validar aquí convertiría un dato histórico inesperado en una excepción al
       * **leer** la agenda, que es el peor momento para fallar. La validación va en `crear`, que es
       * donde se decide un estado nuevo.
       */
      const normal = Cita.crear(BASE);
      expect(() =>
        Cita.reconstruir({
          id: normal.id,
          sucursalId: normal.sucursalId,
          sillaId: normal.sillaId,
          manicuristaId: normal.manicuristaId,
          clientaId: normal.clientaId,
          servicioId: normal.servicioId,
          rangoHorario: normal.rangoHorario,
          estado: 'agendada',
          citaOrigenId: null,
          numeroDeReprogramaciones: 0,
          cotizacionSnapshot: null,
          // La combinación que `crear` rechaza.
          esGarantia: true,
          citaGarantizadaId: null,
        }),
      ).not.toThrow();
    });
  });

  it('asignarManicurista fija el id — la validación de solape la hace la base de datos, no esta clase', () => {
    const cita = Cita.crear(BASE);
    cita.asignarManicurista('55555555-5555-5555-5555-555555555555');

    // Deliberadamente NO comprueba disponibilidad: duplicar esa comprobación en memoria daría
    // una falsa sensación de seguridad y podría divergir de la restricción real.
    expect(cita.manicuristaId).toBe('55555555-5555-5555-5555-555555555555');
  });
});

describe('Silla — la capacidad de la sucursal son filas, no una constante', () => {
  it('nace activa', () => {
    expect(Silla.crear({ sucursalId: BASE.sucursalId, nombre: 'Lomas 1' }).activa).toBe(true);
  });

  it('normaliza el nombre y rechaza el vacío', () => {
    expect(Silla.crear({ sucursalId: BASE.sucursalId, nombre: '  Lomas 1  ' }).nombre).toBe('Lomas 1');
    expect(() => Silla.crear({ sucursalId: BASE.sucursalId, nombre: '   ' })).toThrow(
      expect.objectContaining({ code: 'SILLA_NOMBRE_REQUERIDO' }),
    );
  });

  it('se da de baja lógicamente: una silla retirada sobrevive en las citas históricas', () => {
    const silla = Silla.crear({ sucursalId: BASE.sucursalId, nombre: 'Lomas 1' });
    silla.desactivar();
    expect(silla.activa).toBe(false);
    silla.activar();
    expect(silla.activa).toBe(true);
  });
});
