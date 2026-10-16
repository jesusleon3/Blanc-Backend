import { AvisoSinAcceso } from '../componentes/AvisoSinAcceso';
import { useSesion } from '../auth/sesion';
import { ETIQUETA_DE_ROL } from '../componentes/etiquetas';

/**
 * Para los roles que **no tienen pantalla en esta entrega**: `RECEPCIONISTA`, `ANALISTA` y
 * `SOLO_LECTURA`.
 *
 * Existen en el catálogo de `RN-SEG-01` y reciben `403` en los endpoints de la Bandeja, Anticipos
 * y CRM. Mandarlas a `/bandeja` las dejaría ante una pantalla que falla en cada petición; esto les
 * dice qué pasa.
 */
export function SinAcceso() {
  const { perfil } = useSesion();
  const rol = perfil ? ETIQUETA_DE_ROL[perfil.rol] : 'tu rol';

  return (
    <AvisoSinAcceso
      titulo="Todavía no hay una pantalla para tu rol"
      detalle={`El panel de esta entrega cubre la Bandeja de WhatsApp, Anticipos y Clientas, y está reservado a la Dueña y a las Encargadas. ${rol} tendrá su propia vista en una entrega posterior.`}
    />
  );
}
