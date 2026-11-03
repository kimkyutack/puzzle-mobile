export interface ProviderConfig {
  GOOGLE_CLIENT_IDS?: string; APPLE_CLIENT_IDS?: string;
  APPLE_TEAM_ID?:string; APPLE_AUTH_KEY_ID?:string; APPLE_AUTH_PRIVATE_KEY?:string; APPLE_AUTH_CLIENT_ID?:string; APPLE_AUTH_REDIRECT_URL?:string;
  AUTH_TOKEN_ENCRYPTION_KEY?:string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string; GOOGLE_PACKAGE_NAME?: string; GOOGLE_IAP_ENVIRONMENT?: string;
  APPLE_BUNDLE_ID?: string; APPLE_APP_ID?: string; APPLE_IAP_ISSUER_ID?: string;
  APPLE_IAP_KEY_ID?: string; APPLE_IAP_PRIVATE_KEY?: string;
  APPLE_IAP_ENVIRONMENT?: string; APPLE_ROOT_CA_PEMS?: string;
  ADMOB_AD_UNITS?: string; ADMOB_REWARD_ITEMS?: string;
  GOOGLE_RTDN_AUDIENCE?: string; GOOGLE_RTDN_EMAIL?: string;
}
export class ProviderError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = 'ProviderError'; }
}
export function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new ProviderError('PROVIDER_NOT_CONFIGURED', `${name} 설정이 필요합니다.`, 503);
  return value.trim();
}
export function csv(value: string | undefined, name: string): string[] {
  return required(value, name).split(',').map(v => v.trim()).filter(Boolean);
}
export async function sha256(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), x => x.toString(16).padStart(2, '0')).join('');
}
/** Bound provider responses; never log the raw token/receipt or response. */
export async function providerJSON<T>(response: Response, maximum = 256_000): Promise<T> {
  if (!response.ok) throw new ProviderError('PROVIDER_REQUEST_FAILED', `공급자 확인에 실패했습니다 (${response.status}).`, 502);
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError('PROVIDER_EMPTY_RESPONSE', '공급자 응답이 비어 있습니다.', 502);
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > maximum) { await reader.cancel(); throw new ProviderError('PROVIDER_RESPONSE_TOO_LARGE', '공급자 응답 크기 오류', 502); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
