/** API routes and rules carry the most risk; pure presentational files the least. */
export function auditPriority(filePath: string): number {
  if (filePath.endsWith(".rules")) return 100;
  if (/\/api\/.*route\.ts$/.test(filePath)) return 90;
  if (/(auth|session|token|secret|admin)/i.test(filePath)) return 80;
  if (/\/lib\//.test(filePath)) return 50;
  if (/\.(tsx|jsx)$/.test(filePath)) return 30;
  return 10;
}
