export function hiddenSelectFalseFields(
  schemaFields: Record<string, unknown>,
): Set<string> {
  return new Set(
    Object.entries(schemaFields)
      .filter(([, field]) => {
        return (
          typeof field === 'object' &&
          field !== null &&
          (field as { select?: boolean }).select === false
        );
      })
      .map(([field]) => field),
  );
}

export function mongoVectorProjection(
  schemaFields: Record<string, unknown>,
  select?: string,
): Record<string, 0 | 1> {
  const hiddenFields = hiddenSelectFalseFields(schemaFields);
  const tokens = select?.split(' ').filter(Boolean) ?? [];
  const includeTokens = tokens.filter(token => !token.startsWith('-'));
  if (includeTokens.length) {
    const projection: Record<string, 0 | 1> = { _id: 1, _score: 1 };
    for (const token of includeTokens) {
      if (token !== '_id' && !hiddenFields.has(token)) {
        projection[token] = 1;
      }
    }
    return projection;
  }
  const projection: Record<string, 0 | 1> = {};
  for (const field of hiddenFields) {
    projection[field] = 0;
  }
  for (const token of tokens
    .filter(token => token.startsWith('-'))
    .map(token => token.slice(1))) {
    if (token !== '_id') {
      projection[token] = 0;
    }
  }
  return projection;
}

export function postgresVectorSelectList(
  schemaFields: Record<string, unknown>,
  select: string | undefined,
  quoteIdentifier: (identifier: string) => string,
): string {
  const hiddenFields = hiddenSelectFalseFields(schemaFields);
  const availableFields = Object.keys(schemaFields).filter(
    field => !hiddenFields.has(field),
  );
  if (!availableFields.includes('_id')) {
    availableFields.unshift('_id');
  }
  const tokens = select?.split(' ').filter(Boolean) ?? [];
  const includeTokens = tokens.filter(
    token => !token.startsWith('-') && !hiddenFields.has(token),
  );
  const selected = new Set(includeTokens.length ? includeTokens : availableFields);
  tokens
    .filter(token => token.startsWith('-'))
    .map(token => token.slice(1))
    .forEach(field => {
      if (field !== '_id') selected.delete(field);
    });
  hiddenFields.forEach(field => selected.delete(field));
  selected.add('_id');
  return [...selected].map(field => quoteIdentifier(field)).join(', ');
}
