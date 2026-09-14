import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/errors/http-exception.filter';
import { correlationIdMiddleware } from './shared/correlation-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
