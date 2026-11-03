import type { ApiClient } from '@hangyul/api-client';
import { downloadBlob } from '@hangyul/utils';

import { todayStamp } from './format';

/** Server-side applicant CSV (audited by the API). Hangyul staff must pass the university they are viewing. */
export async function downloadApplicationsCsv(api: ApiClient, scopeId: string | undefined, slug = 'applications') {
  const res = await api.university.exportApplications(scopeId);
  const blob = await res.blob();
  downloadBlob(blob, `${slug}-applications-${todayStamp()}.csv`);
}
