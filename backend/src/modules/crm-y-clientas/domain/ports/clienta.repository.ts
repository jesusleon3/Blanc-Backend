import { Clienta } from '../entities/clienta.entity';
import { TipoDeIncidente } from '../../../../database/schema';

export const CLIENTA_REPOSITORY = 'CLIENTA_REPOSITORY';

export interface IncidenteRegistrado {
  id: string;
  citaId: string;
  tipo: TipoDeIncidente;
  ocurridoEn: Date;
  minutosDeAntelacion: number;
}

export interface NuevoIncidente {
  clientaId: string;
  citaId: string;
  tipo: TipoDeIncidente;
  ocurridoEn: Date;
  minutosDeAntelacion: number;
}

export interface ClientaRepository {
  /** **Puede lanzar 409 `CLIENTA_DUPLICADA`**: mismo nombre y mismo teléfono ya existen. */
  guardar(clienta: Clienta): Promise<void>;
  buscarPorId(id: string): Promise<Clienta | null>;
  buscarPorIds(ids: string[]): Promise<Clienta[]>;

  /**
   * **Devuelve una lista, no una clienta.** Es la consecuencia directa de que el teléfono no sea
   * clave única: mamá e hija comparten número. Quien pregunta tiene que elegir, y por eso este
   * método no puede devolver `Clienta | null` — hacerlo obligaría a inventar un criterio de
   * desempate aquí dentro y a quedarse con la equivocada la mitad de las veces.
   */
  buscarPorTelefono(telefono: string): Promise<Clienta[]>;

  /** Reencuentra a quien cambió de número: nombre + su teléfono anterior. */
  buscarPorNombreYTelefonoAnterior(nombre: string, telefonoAnterior: string): Promise<Clienta[]>;

  /**
   * **Puede lanzar 409 `INCIDENTE_YA_REGISTRADO`** si ya existe uno del mismo tipo para esa cita.
   * Lo impone un índice único: el historial de incidentes es la base de una decisión que
   * perjudica a la clienta, así que un reintento no debe inflarlo.
   */
  registrarIncidente(incidente: NuevoIncidente): Promise<void>;
  listarIncidentes(clientaId: string): Promise<IncidenteRegistrado[]>;
}
