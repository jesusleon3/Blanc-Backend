/**
 * Puerto de atomicidad transversal (RN-AUD-01: la auditoría de una operación de negocio no
 * puede quedar huérfana si la operación falla, ni viceversa). Application depende únicamente de
 * esta interfaz — nunca de Drizzle ni de `db.transaction()` directamente (ADR-002).
 *
 * Contrato: todo lo que el callback `trabajo` haga a través de los repositorios/puertos
 * inyectados (guardar, auditoria.registrar, etc.) se confirma junto, como una sola transacción
 * de base de datos, o se revierte junto si `trabajo` lanza. El caso de uso no necesita saber
 * cómo se logra eso — esa es la responsabilidad de la implementación de Infrastructure.
 */
export interface UnitOfWork {
  ejecutar<T>(trabajo: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = 'UNIT_OF_WORK';
