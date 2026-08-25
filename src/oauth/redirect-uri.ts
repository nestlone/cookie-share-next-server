import { HttpError } from "../errors";

function invalid(message: string): never {
  throw new HttpError(400, message, { success: false, message });
}

/**
 * Only the extension IDs explicitly operated by this deployment may receive
 * OAuth results.  A wildcard for chromiumapp.org would let any installed
 * extension redeem a victim's one-time login code.
 */
export function validateOAuthRedirectUri(value: unknown, allowedExtensionIds: readonly string[], publicBaseUrl: string): string {
  if (typeof value !== "string") invalid("Invalid redirectUri");
  let url: URL;
  try { url = new URL(value); } catch { invalid("Invalid redirectUri"); }
  const extensionId = url.hostname.match(/^([a-p]{32})\.chromiumapp\.org$/)?.[1];
  if (url.protocol === "https:" && extensionId && allowedExtensionIds.includes(extensionId)) return url.toString();

  // Local callbacks are only a development convenience; never expose this
  // exception from a public HTTPS deployment.
  const base = new URL(publicBaseUrl);
  const localServer = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  const localCallback = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (localServer && localCallback) return url.toString();
  invalid("Unsupported redirectUri");
}
