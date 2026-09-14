/** Forma exacta del error de API — 05-api-design.md §2, realización concreta de ADR-013. */
export type ErrorCategory = 'domain' | 'integration' | 'unexpected';

export interface ApiErrorBody {
  error: {
    category: ErrorCategory;
    code: string;
    message: string;
    correlationId?: string;
    details?: Record<string, unknown>;
  };
}

export function buildApiError(
  category: ErrorCategory,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorBody {
  return { error: { category, code, message, details } };
}
