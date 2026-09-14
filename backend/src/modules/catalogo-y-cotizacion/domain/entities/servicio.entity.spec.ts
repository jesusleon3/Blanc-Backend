import { Servicio } from './servicio.entity';
import { ModificadorDiseno } from './modificador-diseno.entity';
import { DomainError } from '../../../../shared/errors/domain-error';

const SERVICIO_VALIDO = { nombre: 'Gelish', categoria: 'aplicacion', duracionBaseMinutos: 60, precioBaseCentavos: 45000 };

describe('Servicio — aggregate raíz del catálogo (FL-COT-01)', () => {
  it('crea un servicio activo por defecto', () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);

    expect(servicio.id).toEqual(expect.any(String));
    expect(servicio.nombre).toBe('Gelish');
    expect(servicio.activo).toBe(true);
  });

  it('normaliza nombre y categoría recortando espacios', () => {
    const servicio = Servicio.crear({ ...SERVICIO_VALIDO, nombre: '  Gelish  ', categoria: '  retiro  ' });
    expect(servicio.nombre).toBe('Gelish');
    expect(servicio.categoria).toBe('retiro');
  });

  it.each([
    ['nombre vacío', { nombre: '   ' }],
    ['categoría vacía', { categoria: '' }],
  ])('rechaza %s', (_caso, sobreescritura) => {
    expect(() => Servicio.crear({ ...SERVICIO_VALIDO, ...sobreescritura })).toThrow(DomainError);
  });

  describe('RN-COT-07 — dinero como entero en centavos', () => {
    it('acepta un importe entero de centavos', () => {
      expect(Servicio.crear({ ...SERVICIO_VALIDO, precioBaseCentavos: 45000 }).precioBaseCentavos).toBe(45000);
    });

    it('acepta cero (un servicio puede ser gratuito)', () => {
      expect(Servicio.crear({ ...SERVICIO_VALIDO, precioBaseCentavos: 0 }).precioBaseCentavos).toBe(0);
    });

    it('rechaza un importe con decimales — es el error que RN-COT-07 existe para impedir', () => {
      // 450.50 "pesos" mal convertidos: si esto pasara, el redondeo flotante corrompería el cobro.
      expect(() => Servicio.crear({ ...SERVICIO_VALIDO, precioBaseCentavos: 45050.5 })).toThrow(DomainError);
    });

    it('rechaza un importe negativo', () => {
      expect(() => Servicio.crear({ ...SERVICIO_VALIDO, precioBaseCentavos: -1 })).toThrow(DomainError);
    });

    it.each([NaN, Infinity])('rechaza un importe no finito (%p)', (valor) => {
      expect(() => Servicio.crear({ ...SERVICIO_VALIDO, precioBaseCentavos: valor })).toThrow(DomainError);
    });

    it('el código de error identifica el campo monetario concreto', () => {
      expect(() => Servicio.crear({ ...SERVICIO_VALIDO, precioBaseCentavos: 1.5 })).toThrow(
        expect.objectContaining({ code: 'SERVICIO_PRECIO_BASE_INVALIDO' }),
      );
    });
  });

  describe('duración', () => {
    it('rechaza minutos fraccionarios o negativos', () => {
      expect(() => Servicio.crear({ ...SERVICIO_VALIDO, duracionBaseMinutos: 45.5 })).toThrow(DomainError);
      expect(() => Servicio.crear({ ...SERVICIO_VALIDO, duracionBaseMinutos: -10 })).toThrow(DomainError);
    });
  });

  describe('actualizarDatos', () => {
    it('aplica solo los campos provistos', () => {
      const servicio = Servicio.crear(SERVICIO_VALIDO);
      servicio.actualizarDatos({ precioBaseCentavos: 50000 });

      expect(servicio.precioBaseCentavos).toBe(50000);
      expect(servicio.nombre).toBe('Gelish');
      expect(servicio.duracionBaseMinutos).toBe(60);
    });

    it('vuelve a validar el importe en una actualización, no solo al crear', () => {
      const servicio = Servicio.crear(SERVICIO_VALIDO);
      expect(() => servicio.actualizarDatos({ precioBaseCentavos: 99.99 })).toThrow(DomainError);
      expect(servicio.precioBaseCentavos).toBe(45000);
    });
  });

  describe('baja del catálogo', () => {
    it('desactiva y reactiva sin borrar (preserva el historial de citas ya cotizadas)', () => {
      const servicio = Servicio.crear(SERVICIO_VALIDO);

      servicio.desactivar();
      expect(servicio.activo).toBe(false);

      servicio.activar();
      expect(servicio.activo).toBe(true);
    });
  });
});

describe('ModificadorDiseno — aggregate raíz independiente (01-domain-discovery §5.2)', () => {
  const MODIFICADOR_VALIDO = { nombre: 'Diseño francés', minutosAdicionales: 15, precioAdicionalCentavos: 8000 };

  it('crea un modificador con sus valores adicionales, activo por defecto', () => {
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);

    expect(modificador.nombre).toBe('Diseño francés');
    expect(modificador.minutosAdicionales).toBe(15);
    expect(modificador.precioAdicionalCentavos).toBe(8000);
    expect(modificador.activo).toBe(true);
  });

  it('desactiva y reactiva sin borrar — un modificador descontinuado sobrevive en las citas ya cotizadas', () => {
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);

    modificador.desactivar();
    expect(modificador.activo).toBe(false);

    modificador.activar();
    expect(modificador.activo).toBe(true);
  });

  it('no expone ninguna colección de servicios: el vínculo vive en la tabla de unión, no en el aggregate', () => {
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    expect(modificador).not.toHaveProperty('servicios');
    expect(modificador).not.toHaveProperty('serviciosAplicables');
  });

  describe('RN-COT-07 — mismas garantías monetarias que Servicio', () => {
    it('rechaza un importe adicional con decimales', () => {
      expect(() => ModificadorDiseno.crear({ ...MODIFICADOR_VALIDO, precioAdicionalCentavos: 80.5 })).toThrow(
        expect.objectContaining({ code: 'MODIFICADOR_PRECIO_ADICIONAL_INVALIDO' }),
      );
    });

    it('rechaza un importe adicional negativo', () => {
      expect(() => ModificadorDiseno.crear({ ...MODIFICADOR_VALIDO, precioAdicionalCentavos: -500 })).toThrow(DomainError);
    });

    it('acepta cero minutos y cero precio (un modificador puede ser solo estético)', () => {
      const modificador = ModificadorDiseno.crear({ ...MODIFICADOR_VALIDO, minutosAdicionales: 0, precioAdicionalCentavos: 0 });
      expect(modificador.minutosAdicionales).toBe(0);
      expect(modificador.precioAdicionalCentavos).toBe(0);
    });
  });

  it('rechaza nombre vacío', () => {
    expect(() => ModificadorDiseno.crear({ ...MODIFICADOR_VALIDO, nombre: '  ' })).toThrow(DomainError);
  });

  it('actualizarDatos vuelve a validar el importe', () => {
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    expect(() => modificador.actualizarDatos({ precioAdicionalCentavos: 1.25 })).toThrow(DomainError);
    expect(modificador.precioAdicionalCentavos).toBe(8000);
  });
});
