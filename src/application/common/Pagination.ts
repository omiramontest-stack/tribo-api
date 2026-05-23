export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/**
 * Parsea y sanitiza los query params de paginación.
 * Clampea `limit` a [1, 100] y `page` a [1, ∞) para prevenir
 * dumps completos de tabla con limit=999999.
 */
export function parsePagination(query: { page?: string; limit?: string }): PaginationParams {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))
  return { page, limit }
}

export function paginate(params: PaginationParams): { skip: number; take: number } {
  const page = Math.max(1, params.page)
  const limit = Math.min(100, Math.max(1, params.limit))
  return { skip: (page - 1) * limit, take: limit }
}

export function toPaginatedResult<T>(data: T[], total: number, params: PaginationParams): PaginatedResult<T> {
  const limit = Math.min(100, Math.max(1, params.limit))
  return {
    data,
    meta: {
      total,
      page: Math.max(1, params.page),
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}
