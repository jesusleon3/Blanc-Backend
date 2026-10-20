-- Columna `codigo` y desglose de las filas agrupadas del catalogo oficial (2026-10-21).
--
-- EL PROBLEMA QUE RESUELVE, EN UNA FRASE: el resolutor del bot encontraba la fila del catalogo
-- POR SU NOMBRE, y la Dueña puede renombrar cualquier servicio desde /admin. Renombrar
-- "Rubber + gel" dejaba al bot sin poder agendarlo — escalaba en vez de agendar, y nadie entendia
-- por que, porque la pantalla seguia mostrando el servicio perfectamente.
--
-- El `codigo` es el identificador que NO CAMBIA NUNCA. El nombre es para la clienta y para la
-- Dueña; el codigo es para el sistema. Ni el alta ni la edicion de /admin lo aceptan.
ALTER TABLE "catalogo_cotizacion"."servicios" ADD COLUMN "codigo" varchar(48);
--> statement-breakpoint
-- A PARTIR DE AQUI, SQL ESCRITO A MANO — Drizzle no sabe expresar un indice parcial ni un UPDATE
-- de datos, y por tanto NO estan en su snapshot.
--
-- INDICE UNICO PARCIAL, no unico total: `codigo` es NULO para los servicios que la Dueña cree desde
-- /admin, y eso es correcto — un servicio que no esta en la matriz oficial no tiene codigo porque
-- el bot no puede resolverlo de todas formas. Un UNIQUE total prohibiria el segundo servicio sin
-- codigo (en PostgreSQL varios NULL no chocan en un UNIQUE, pero el indice parcial dice la
-- intencion en voz alta y ademas solo indexa las filas que importan).
--
-- NO se genera un codigo automatico para las filas nuevas a proposito: tener codigo significa
-- "esta fila es parte de la matriz oficial y el bot sabe resolverla". Generar uno para un servicio
-- inventado en /admin seria afirmar algo falso.
CREATE UNIQUE INDEX IF NOT EXISTS "servicios_codigo_unico"
  ON "catalogo_cotizacion"."servicios" ("codigo")
  WHERE "codigo" IS NOT NULL;
--> statement-breakpoint
-- DESGLOSE DE LAS FILAS AGRUPADAS: se DESACTIVAN las cuatro familias que agrupaban varias
-- combinaciones en un solo renglon porque compartian bloque de tiempo.
--
-- Para el TIEMPO eran exactas; para el PRECIO significaban un solo importe para tres combinaciones
-- que no cuestan lo mismo, y no habia forma de arreglarlo desde /admin. El seed las sustituye por
-- renglones individuales con su propio precio.
--
-- SE DESACTIVAN, NO SE BORRAN: una cita que ya las uso conserva su `cotizacion_snapshot` con el
-- nombre y el precio congelados, asi que sigue siendo legible. Y `activo = false` es reversible
-- desde /admin si alguien necesitara mirarlas.
--
-- El `WHERE codigo IS NULL` acota el UPDATE a las filas que sembro la version anterior: si alguien
-- ya hubiera creado a mano un servicio con uno de esos nombres, tampoco tendria codigo — y
-- desactivarlo seria igual de correcto, porque esos nombres describen combinaciones que ahora
-- viven desglosadas.
UPDATE "catalogo_cotizacion"."servicios"
SET "activo" = false, "actualizado_en" = now()
WHERE "codigo" IS NULL
  AND "nombre" IN (
    'Retiro de gel + rubber, gel o manicure',
    'Retiro de acrílico o rubber + rubber, gel o manicure',
    'Retiro de acrílico o rubber + extensiones o baño de acrílico',
    'Retiro de acrílico o rubber + extensiones o baño de acrílico + manicure',
    'Extensiones o baño de acrílico + diseño estándar'
  );
