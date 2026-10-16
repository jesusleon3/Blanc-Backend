export function Vacio({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-borde p-10 text-center">
      <p className="text-sm font-medium text-texto-secundario">{titulo}</p>
      {detalle ? <p className="max-w-sm text-xs text-texto-terciario">{detalle}</p> : null}
    </div>
  );
}
