import { ApiError, type ApiClient } from '@hangyul/api-client';
import type { DocumentCategory, DocumentRequest as TDocumentRequest, MessageAttachment } from '@hangyul/types';

import type { PickedFile } from './Upload';

/**
 * Typed helpers for V3 endpoints that other workstreams add to the API. They go through the shared client's
 * generic `request`, so the mobile apps don't depend on a particular api-client revision. Screens treat 404/405 as
 * "not available on this server yet" and hide the feature rather than failing.
 */

export const isUnavailable = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501);

async function webSafe(file: PickedFile): Promise<PickedFile | Blob> {
  if (typeof document !== 'undefined' && /^(blob|data):/.test(file.uri)) {
    const blob = await (await fetch(file.uri)).blob();
    return new File([blob], file.name, { type: file.type }) as unknown as Blob;
  }
  return file;
}

async function multipart<R>(api: ApiClient, path: string, file: PickedFile, fields?: Record<string, string | undefined>) {
  const f = await webSafe(file);
  const body = new FormData();
  body.append('file', f as unknown as Blob, file.name);
  for (const [k, v] of Object.entries(fields ?? {})) if (v !== undefined) body.append(k, v);
  return api.request<R>(path, { method: 'POST', form: body });
}

export type Attachment = MessageAttachment;
export type DocumentRequest = TDocumentRequest;
export interface Metric {
  key: string; label?: string; value: number | null; numerator: number | null; denominator: number | null;
  population: string; period: string; definition: string; insufficient: boolean;
}
export interface SavedView { id: string; name: string; scope: 'PERSONAL' | 'TEAM' | 'ORGANIZATION'; filters: Record<string, unknown>; count?: number }
export interface QuickEligibility { eligible_count: number; possible_count: number; unlock?: { requirement: string; count: number } | null }

export const v3 = {
  uploadDocument: (api: ApiClient, file: PickedFile, meta: { category: DocumentCategory; title?: string; student_user_id?: string; document_id?: string; issuing_country?: string }) =>
    multipart<{ id: string }>(api, '/documents', file, { category: meta.category, title: meta.title, student_user_id: meta.student_user_id, document_id: meta.document_id, issuing_country: meta.issuing_country }),
  uploadAttachment: (api: ApiClient, conversationId: string, file: PickedFile) =>
    multipart<Attachment>(api, `/conversations/${conversationId}/attachments`, file),
  sendWithAttachments: (api: ApiClient, conversationId: string, body: { body: string; internal?: boolean; attachment_ids: string[] }) =>
    api.post(`/conversations/${conversationId}/messages`, body),
  attachmentUrl: (api: ApiClient, id: string) => api.post<{ url: string }>(`/attachments/${id}/download-url`),
  fulfillRequest: (api: ApiClient, id: string, document_id?: string) => api.post(`/document-requests/${id}/fulfill`, { document_id }),
  requestDocuments: (api: ApiClient, applicationId: string, body: { label: string; note: string; category?: string | null; due_date?: string | null }) =>
    api.post(`/applications/${applicationId}/document-requests`, body),
  universityMetrics: (api: ApiClient, query?: Record<string, string>) => api.get<{ metrics: Metric[]; population?: string; period?: string }>('/university/metrics', query),
  savedViews: (api: ApiClient) => api.get<SavedView[] | { items: SavedView[] }>('/agency/saved-views'),
  quickEligibility: (api: ApiClient, body: { nationality: string; degree: string; language: { test: string; level?: number | null } }) =>
    api.post<QuickEligibility>('/public/quick-eligibility', body),
};
