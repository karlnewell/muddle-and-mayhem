export function stripComments(source: string): string;
export function findViolations(
  source: string,
  filename: string,
): Array<{ file: string; line: number; token: string }>;
