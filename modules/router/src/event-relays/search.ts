export function parsePagination(
  skip?: number,
  limit?: number,
): { skip: number; limit: number } {
  return {
    skip: skip ?? 0,
    limit: limit ?? 25,
  };
}

export function buildSearchQuery(search?: string | null): Record<string, unknown> {
  if (search == null || search === '') {
    return {};
  }
  if (/^[a-fA-F\d]{24}$/.test(search)) {
    return { _id: search };
  }
  const identifier = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    $or: [
      { name: { $regex: `.*${identifier}.*`, $options: 'i' } },
      { busEvent: { $regex: `.*${identifier}.*`, $options: 'i' } },
      { socketEvent: { $regex: `.*${identifier}.*`, $options: 'i' } },
    ],
  };
}
