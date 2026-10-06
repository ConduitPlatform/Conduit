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

export function parseAuthorizedDocumentRoom(room: string): {
  schema: string;
  documentId: string;
  userId: string;
} | null {
  const prefix = `${ROOM_PREFIX}:doc:`;
  if (!room.startsWith(prefix)) return null;
  const rest = room.slice(prefix.length);
  const userMarker = ':user:';
  const userIndex = rest.lastIndexOf(userMarker);
  if (userIndex === -1) return null;
  const userId = decodeURIComponent(rest.slice(userIndex + userMarker.length));
  const schemaDoc = rest.slice(0, userIndex);
  const lastColon = schemaDoc.lastIndexOf(':');
  if (lastColon === -1) return null;
  return {
    schema: decodeURIComponent(schemaDoc.slice(0, lastColon)),
    documentId: decodeURIComponent(schemaDoc.slice(lastColon + 1)),
    userId,
  };
}
