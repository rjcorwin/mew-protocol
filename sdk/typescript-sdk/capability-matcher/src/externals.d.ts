declare module 'micromatch' {
  export interface IsMatchOptions {
    nocase?: boolean;
    dot?: boolean;
    [key: string]: unknown;
  }

  export function isMatch(
    value: string,
    patterns: string | string[],
    options?: IsMatchOptions
  ): boolean;

  const micromatch: {
    isMatch: typeof isMatch;
  };

  export default micromatch;
}

declare module 'jsonpath-plus' {
  export interface JSONPathOptions<T = unknown> {
    path: string;
    json: T;
    resultType?: 'value' | 'path';
    wrap?: boolean;
  }

  export function JSONPath<T = unknown, R = unknown>(
    options: JSONPathOptions<T>
  ): R[];
}
