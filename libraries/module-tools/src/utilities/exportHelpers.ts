/**
 * Reusable helpers for module export/import (GitOps).
 * Standardizes stripping internal fields and optional export/import flows.
 */

import type { ImportResultEntry } from '../interfaces/ResourceExporter.js';

/** Fields removed from documents when exporting (so they are not versioned). */
export const DEFAULT_STRIP_FIELDS = ['_id', 'createdAt', 'updatedAt', '__v'] as const;

/**
 * Removes internal and optionally extra fields from a single document.
 * Does not mutate the original if the result would differ.
 */
export function stripInternalFields(
  obj: Record<string, unknown>,
  additionalFields: string[] = [],
): Record<string, unknown> {
  const strip = new Set([...DEFAULT_STRIP_FIELDS, ...additionalFields]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!strip.has(k)) out[k] = v;
  }
  return out;
}

export interface SanitizeForExportOptions {
  /** Extra field names to remove (in addition to DEFAULT_STRIP_FIELDS). */
  excludeFields?: string[];
}

/**
 * Returns a copy of each document with internal fields stripped.
 * Use after fetching from DB to produce export-safe arrays.
 */
export function sanitizeDocumentsForExport<T extends Record<string, unknown>>(
  documents: T[],
  options: SanitizeForExportOptions = {},
): Record<string, unknown>[] {
  const exclude = options.excludeFields ?? [];
  return documents.map(doc => stripInternalFields(doc, exclude));
}

/**
 * Minimal model interface for export: can return all records.
 */
export interface ExportModelAdapter {
  findMany(
    query?: Record<string, unknown>,
    options?: { select?: string },
  ): Promise<Record<string, unknown>[]>;
}

/**
 * Fetches all documents from the adapter and returns them with internal fields stripped.
 */
export async function exportModel(
  adapter: ExportModelAdapter,
  options: SanitizeForExportOptions & {
    query?: Record<string, unknown>;
    select?: string;
  } = {},
): Promise<Record<string, unknown>[]> {
  const { query, select, excludeFields, ...rest } =
    options as SanitizeForExportOptions & {
      query?: Record<string, unknown>;
      select?: string;
    };
  const docs = await adapter.findMany(query ?? {}, select ? { select } : {});
  return sanitizeDocumentsForExport(docs, { excludeFields, ...rest });
}

/**
 * Minimal model interface for import: find by key, create, update.
 */
export interface ImportModelAdapter {
  keyField: string;
  findOne(query: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  create(doc: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateOne(
    filter: Record<string, unknown>,
    doc: Record<string, unknown>,
  ): Promise<unknown>;
}

/**
 * Upserts records by keyField. Returns counts and errors for ImportResultEntry.
 */
export async function importModel(
  adapter: ImportModelAdapter,
  records: Record<string, unknown>[],
  options: SanitizeForExportOptions = {},
): Promise<ImportResultEntry> {
  const entry: ImportResultEntry = { created: 0, updated: 0, failed: 0, errors: [] };
  const keyField = adapter.keyField;

  for (const record of records) {
    const key = record[keyField];
    if (key == null || key === '') {
      entry.failed += 1;
      entry.errors.push(`Missing or empty key "${keyField}" in record`);
      continue;
    }

    try {
      const existing = await adapter.findOne({ [keyField]: key });
      const sanitized = stripInternalFields(record, options.excludeFields ?? []);

      if (existing) {
        await adapter.updateOne({ [keyField]: key }, sanitized);
        entry.updated += 1;
      } else {
        await adapter.create(sanitized);
        entry.created += 1;
      }
    } catch (err) {
      entry.failed += 1;
      entry.errors.push(`${String(key)}: ${(err as Error).message}`);
    }
  }

  return entry;
}
