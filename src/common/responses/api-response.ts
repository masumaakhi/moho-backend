export function successResponse<T>(
  message: string,
  data?: T,
  meta?: Record<string, unknown>,
) {
  return {
    success: true,
    message,
    data: data ?? null,
    meta: meta ?? null,
  };
}

export function errorResponse(
  message: string,
  errors?: Record<string, unknown>[],
) {
  return {
    success: false,
    message,
    errors: errors ?? [],
  };
}