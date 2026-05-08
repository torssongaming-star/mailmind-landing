/**
 * Template variable interpolation for reply templates.
 * Supports {{variable_name}} syntax.
 */

export function interpolateTemplate(
  body: string,
  vars: Record<string, string>
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
