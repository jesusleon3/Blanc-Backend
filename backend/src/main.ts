import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'http';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/errors/http-exception.filter';
import { correlationIdMiddleware } from './shared/correlation-id.middleware';

/**
 * CORS **por lista explícita de orígenes**, nunca abierto.
 *
 * ## POR QUÉ NO BASTA `app.enableCors()`
 *
 * Esa llamada sin argumentos responde `Access-Control-Allow-Origin: *`, y aquí eso sería un
 * problema concreto: la API se autentica con un JWT que el frontend manda en una cabecera, así que
 * **cualquier página web podría pedirle datos a Blanc usando el token de una Encargada que tuviera
 * el panel abierto**. No es un riesgo teórico — es el ataque que CORS existe para impedir.
 *
 * ## CÓMO SE COMPORTA SEGÚN EL ENTORNO
 *
 * - **Con `CORS_ORIGIN`**: lista separada por comas. Es lo que se configura en Railway.
 * - **Sin `CORS_ORIGIN` y en desarrollo**: se permite el Vite local (`localhost:5173`), porque es
 *   el único caso en que frontend y backend están en puertos distintos.
 * - **Sin `CORS_ORIGIN` y en producción**: **CORS queda desactivado por completo**, y es
 *   deliberado. El despliegue previsto sirve los estáticos del frontend **desde el mismo origen**
 *   que la API (`ADR-027`), así que no hace falta ningún CORS: si el panel funciona, es que el
 *   origen es el mismo. Y si algún día se separan, lo que falla es la petición del navegador con
 *   un mensaje de CORS claro — **no una API abierta al mundo en silencio**. Fallar cerrado.
 *
 * El webhook de Meta no se ve afectado: es una petición servidor-a-servidor, y CORS solo aplica a
 * navegadores.
 */
function configurarCors(app: Awaited<ReturnType<typeof NestFactory.create>>): void {
  const configurados = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen.length > 0);

  const esProduccion = process.env.NODE_ENV === 'production';
  const origenes = configurados.length > 0 ? configurados : esProduccion ? [] : ['http://localhost:5173'];

  if (origenes.length === 0) {
    new Logger('Bootstrap').log('CORS desactivado: se asume el frontend servido desde el mismo origen. Usa CORS_ORIGIN si no es el caso.');
    return;
  }

  app.enableCors({
    origin: origenes,
    // `Authorization` porque el JWT va ahí; `x-correlation-id` porque el frontend puede
    // propagarlo para que un fallo sea rastreable entre las dos mitades.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // `false` a propósito: no se usan cookies, el token viaja en la cabecera. Ponerlo en `true`
    // ampliaría la superficie sin que nada lo necesite.
    credentials: false,
    maxAge: 86_400,
  });
  new Logger('Bootstrap').log(`CORS activo para: ${origenes.join(', ')}`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * CUERPO CRUDO PARA LA FIRMA DEL WEBHOOK DE META.
   *
   * El HMAC-SHA256 de `X-Hub-Signature-256` se calcula sobre **los bytes exactos** que Meta firmó.
   * Volver a serializar el JSON ya parseado cambia espacios y orden de claves, así que la firma
   * **nunca** coincidiría: sin esto, el webhook sería inverificable y habría que elegir entre
   * dejarlo sin autenticar o rechazar todo.
   *
   * Se captura con el `verify` del parser de Express, que recibe el buffer antes de parsear. Se
   * aplica a todas las rutas y no solo al webhook porque el parser es global; el coste es una
   * referencia al buffer por petición, que Node ya tenía en memoria.
   */
  const capturarCuerpoCrudo = (peticion: IncomingMessage, _respuesta: ServerResponse, buffer: Buffer) => {
    if (buffer?.length) (peticion as IncomingMessage & { rawBody?: Buffer }).rawBody = buffer;
  };
  app.use(json({ verify: capturarCuerpoCrudo }));
  app.use(urlencoded({ extended: true, verify: capturarCuerpoCrudo }));

  configurarCors(app);

  app.use(correlationIdMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  // Sin esto, los hooks `onModuleDestroy` (p. ej. el cierre del pool de Postgres, Tarea 8 del
  // hardening 2026-08-11) nunca se ejecutan ante un SIGTERM real (Railway al desplegar/reiniciar)
  // — solo ante un `app.close()` explícito, que nada llama en producción.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
