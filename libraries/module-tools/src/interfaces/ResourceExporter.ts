/**
 * Framework-level types for module export/import (GitOps / config-as-code).
 * Modules that implement getExportableResources(), exportResources(), and importResources()
 * can participate in unified state export/import via Core.
 */

export interface ExportableResource {
  /** e.g. "schemas", "emailTemplates", "resourceDefinitions" */
  type: string;
  /** Human-readable description */
  description: string;
  /** Import ordering: lower = imported first (e.g. schemas before endpoints) */
  priority: number;
}

/** Per-resource-type arrays of exportable data (e.g. { schemas: [...], customEndpoints: [...] }) */
export interface ExportResult {
  [resourceType: string]: unknown[];
}

/** Per-resource-type import outcome */
export interface ImportResultEntry {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface ImportResult {
  [resourceType: string]: ImportResultEntry;
}
