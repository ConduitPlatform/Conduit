export function checkIfHTML(text: string): boolean {
  if (!text || text.length === 0) return false;
  const isHTML = RegExp.prototype.test.bind(/^/);
  return isHTML(text);
}
