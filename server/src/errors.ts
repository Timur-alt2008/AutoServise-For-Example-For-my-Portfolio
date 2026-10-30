/** Коды ошибок анализатора. Они показываются в панели и используются в тестах. */
export type ErrorCode =
  | 'invalid_url'
  | 'private_address'
  | 'dns_error'
  | 'connection_refused'
  | 'network_error'
  | 'timeout'
  | 'robots_disallowed'
  | 'robots_unreachable'
  | 'blocked'
  | 'http_error'
  | 'unsupported_content'
  | 'too_many_redirects'
  | 'search_not_configured'
  | 'search_failed'
  | 'ai_not_configured'
  | 'ai_failed'
  | 'not_found'
  | 'bad_request'
  | 'invalid_transition'
  | 'booking_not_configured'
  | 'rate_limited'
  | 'interrupted'
  | 'unauthorized'
  | 'internal';

const HTTP_STATUS: Record<ErrorCode, number> = {
  invalid_url: 400,
  private_address: 400,
  dns_error: 422,
  connection_refused: 422,
  network_error: 422,
  timeout: 422,
  robots_disallowed: 422,
  robots_unreachable: 422,
  blocked: 422,
  http_error: 422,
  unsupported_content: 422,
  too_many_redirects: 422,
  search_not_configured: 503,
  search_failed: 502,
  ai_not_configured: 503,
  ai_failed: 502,
  not_found: 404,
  bad_request: 400,
  invalid_transition: 409,
  booking_not_configured: 501,
  rate_limited: 429,
  interrupted: 500,
  unauthorized: 401,
  internal: 500,
};

export class AnalyzerError extends Error {
  code: ErrorCode;
  details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AnalyzerError';
    this.code = code;
    this.details = details;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code] ?? 500;
  }
}

/** Ошибки, при которых сайт сознательно не читается: мы не пытаемся их обойти. */
export function isBlockingCode(code: ErrorCode): boolean {
  return code === 'robots_disallowed' || code === 'robots_unreachable' || code === 'blocked';
}
