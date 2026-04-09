/** Bozuk `%` dizilerinde uygulama çökmesin diye güvenli decode. */
export function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
