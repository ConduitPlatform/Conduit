export interface EmbeddingJobData {
  schemaName: string;
  documentId: string;
  configId?: string;
}

export function embeddingJobId(data: EmbeddingJobData): string {
  const parts = [data.schemaName, data.documentId];
  if (data.configId) parts.push(data.configId);
  return parts.join('__');
}

export function dedupeEmbeddingJobs(jobs: EmbeddingJobData[]): EmbeddingJobData[] {
  const seen = new Set<string>();
  const unique: EmbeddingJobData[] = [];
  for (const job of jobs) {
    const id = embeddingJobId(job);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(job);
  }
  return unique;
}

export function isDuplicateJobError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /already exists/i.test(message);
}
