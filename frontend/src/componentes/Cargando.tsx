export function Cargando({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-8" role="status" aria-live="polite">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-borde border-t-acentuado" aria-hidden="true" />
      <p className="text-sm text-texto-secundario">{mensaje}</p>
    </div>
  );
}
