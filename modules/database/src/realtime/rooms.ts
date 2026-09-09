const ROOM_PREFIX = 'database';

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

export function schemaRoom(schema: string): string {
  return `${ROOM_PREFIX}:schema:${encodeSegment(schema)}`;
}

export function documentRoom(schema: string, documentId: string): string {
  return `${ROOM_PREFIX}:doc:${encodeSegment(schema)}:${encodeSegment(documentId)}`;
}

export function authorizedDocumentRoom(
  schema: string,
  documentId: string,
  userId: string,
): string {
  return `${ROOM_PREFIX}:doc:${encodeSegment(schema)}:${encodeSegment(documentId)}:user:${encodeSegment(userId)}`;
}

export function roomsForPublicChange(schema: string, documentId: string): string[] {
  return [schemaRoom(schema), documentRoom(schema, documentId)];
}
