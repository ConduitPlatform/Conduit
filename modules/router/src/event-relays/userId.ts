/** User id of a socket context: set as `userId` in jwt mode, `user._id` in session mode. */
export function contextUserId(
  context?: { userId?: unknown; user?: { _id?: unknown } } | null,
): string | undefined {
  const id = context?.userId ?? context?.user?._id;
  return id ? String(id) : undefined;
}
