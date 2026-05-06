/**
 * Strip deprecated request fields and collect warnings before Zod validation.
 */

export type ModelWarning = {
  code: string;
  severity: 'info' | 'warning';
  message: string;
};

export function preprocessSimulateBody(body: unknown): { payload: unknown; warnings: ModelWarning[] } {
  const warnings: ModelWarning[] = [];
  if (body === null || typeof body !== 'object') {
    return { payload: body, warnings };
  }
  const payload = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;

  const loc = payload['location'];
  if (loc && typeof loc === 'object' && loc !== null && 'area_type' in loc) {
    warnings.push({
      code: 'deprecated.field_removed',
      severity: 'warning',
      message:
        'location.area_type was removed and ignored. Area-type shading was an unsupported heuristic and is no longer used.'
    });
    delete (loc as Record<string, unknown>)['area_type'];
  }

  return { payload, warnings };
}
