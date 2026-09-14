import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from './domain-error';
import { buildApiError } from './api-error';

/**
 * Traduce cualquier excepción al formato único de error (05-api-design.md §2), con las tres
 * categorías de ADR-013. Es el único lugar del sistema que decide la forma final del error
 * HTTP — ningún controlador construye su propio cuerpo de error.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers['x-correlation-id'] as string) ?? 'sin-correlacion';

    if (exception instanceof DomainError) {
      const body = buildApiError('domain', exception.code, exception.message, exception.details);
      body.error.correlationId = correlationId;
      response.status(exception.httpStatus).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      // Los guards de auth/roles ya emiten el cuerpo con la forma correcta (Sección 5/6, 05-api-design.md)
      // — se reconoce por tener `error` como OBJETO; Nest's propio BadRequestException (ValidationPipe)
      // también usa la clave `error`, pero como STRING ("Bad Request"), por eso se valida el tipo exacto.
      if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as Record<string, unknown>).error === 'object') {
        const body = payload as ReturnType<typeof buildApiError>;
        body.error.correlationId = correlationId;
        response.status(status).json(body);
        return;
      }
      const mensajeCrudo = (payload as Record<string, unknown>)?.message ?? exception.message;
      const message = Array.isArray(mensajeCrudo) ? mensajeCrudo.join('; ') : typeof payload === 'string' ? payload : mensajeCrudo;
      const body = buildApiError('domain', 'SOLICITUD_INVALIDA', String(message));
      body.error.correlationId = correlationId;
      response.status(status).json(body);
      return;
    }

    // Categoría "unexpected" (ADR-013, categoría 3): se registra con contexto completo y se
    // alerta — aquí, sin backend de observabilidad todavía elegido (03 §3.14), solo se registra.
    this.logger.error(exception instanceof Error ? exception.stack : exception, correlationId);
    const body = buildApiError('unexpected', 'ERROR_INESPERADO', 'Ocurrió un error inesperado.');
    body.error.correlationId = correlationId;
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
