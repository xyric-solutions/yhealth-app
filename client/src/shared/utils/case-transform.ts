/**
 * Case Transformation Utilities
 * Converts snake_case API responses to camelCase for TypeScript interfaces
 */

/**
 * Convert snake_case string to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively transform object keys from snake_case to camelCase
 */
export function transformKeysToCamelCase<T>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeysToCamelCase(item)) as unknown as T;
  }

  if (typeof obj !== 'object') {
    return obj as T;
  }

  const transformed: Record<string, unknown> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamel(key);
      const value = (obj as Record<string, unknown>)[key];
      
      // Recursively transform nested objects and arrays
      if (value && typeof value === 'object') {
        transformed[camelKey] = transformKeysToCamelCase(value);
      } else {
        transformed[camelKey] = value;
      }
    }
  }

  return transformed as T;
}

