import { IsInt, IsString, Min, MinLength } from 'class-validator';

/**
 * Cuerpo de `POST /v1/catalogo-y-cotizacion/servicios`.
 *
 * SOBRE `@IsInt()` EN LOS CAMPOS NUMÉRICOS (`RN-COT-07`): es la primera de dos barreras, no la
 * única. `validarImporteEnCentavos()` en el dominio rechaza el mismo caso y seguiría haciéndolo si
 * alguien invocara el caso de uso desde otro adaptador (un consumidor de eventos, un comando de
 * CLI). Esta capa existe para que un `450.75` enviado por HTTP muera como `400 Bad Request` con el
 * nombre del campo, en vez de llegar al dominio y salir como un error genérico.
 *
 * `@IsInt()` delega en `Number.isInteger`, así que rechaza decimales, `NaN` e `Infinity`. El
 * `ValidationPipe` global corre con `transform: true` pero **sin** `enableImplicitConversion`
 * (ver `main.ts`), de modo que una cadena `"45000"` tampoco pasa: no se coacciona a número.
 */
export class CrearServicioDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

  /** Incluye `retiro` como categoría propia (`RN-COT-02`), no como variante de una aplicación. */
  @IsString()
  @MinLength(1)
  categoria!: string;

  @IsInt()
  @Min(0)
  duracionBaseMinutos!: number;

  /** Importe en **centavos** enteros (`RN-COT-07`) — nunca en pesos, nunca con decimales. */
  @IsInt()
  @Min(0)
  precioBaseCentavos!: number;
}
