export function checkIfHTML(text: string): boolean {
  if (!text || text.length === 0) return false;
  var isHTML = RegExp.prototype.test.bind(/^/);
  return isHTML(text);
}
