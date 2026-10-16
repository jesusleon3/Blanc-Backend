import type { ReactNode } from 'react';

export type TonoDeInsignia = 'neutro' | 'exito' | 'aviso' | 'peligro' | 'info' | 'acento';

const CLASES: Record<TonoDeInsignia, string> = {
  neutro: 'bg-fondo-apagado text-texto-secundario',
  exito: 'bg-exito-suave text-exito',
  aviso: 'bg-aviso-suave text-aviso',
  peligro: 'bg-peligro-suave text-peligro',
  info: 'bg-info-suave text-info',
  acento: 'bg-acento-100 text-acento-700',
};

export function Insignia({ tono = 'neutro', children }: { tono?: TonoDeInsignia; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CLASES[tono]}`}>{children}</span>
  );
}
