/**
 * Puerto de auditoría (RN-AUD-01, ADR-010) — de solo-anexado, compartido por todos los módulos.
 * FL-SUC-01/02/03/04 citan `FL-AUD-01` como micro-flow obligatorio; este puerto es su
 * realización en código para el módulo Sucursales y Personal.
 */
export interface RegistrarAuditoriaEntrada {
  tipoAccion: string;
  actor: string;
  sucursalRelacionada?: string;
  entidadAfectadaTipo: string;
  entidadAfectadaId: string;
  detalle?: Record<string, unknown>;
}

export interface AuditoriaPort {
  registrar(entrada: RegistrarAuditoriaEntrada): Promise<void>;
}

export const AUDITORIA_PORT = 'AUDITORIA_PORT';
