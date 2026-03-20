function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function hasFormErrorFields(error: unknown): boolean {
  return isObject(error) && Array.isArray(error.errorFields)
}
