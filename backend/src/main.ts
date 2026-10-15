import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'http';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/errors/http-exception.filter';
import { correlationIdMiddleware } from './shared/correlation-id.middleware';

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
