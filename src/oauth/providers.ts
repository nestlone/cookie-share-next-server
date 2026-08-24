import type { OAuthProviderConfig, OAuthProviderId } from "../types";

export interface OAuthIdentity {
  subject: string;
  login: string;
}

export interface OAuthProvider {
  id: OAuthProviderId;
  name: string;
  authorizeUrl(params: { redirectUri: string; state: string; codeChallenge: string }): string;
  exchangeCode(params: { code: string; redirectUri: string; codeVerifier: string }): Promise<OAuthIdentity>;
}

interface Definition {
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
  parseIdentity(payload: Record<string, unknown>): OAuthIdentity;
}

const definitions: Record<OAuthProviderId, Definition> = {
  github: {
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userinfoUrl: "https://api.github.com/user",
    scopes: ["read:user"],
    parseIdentity: (payload) => ({ subject: String(payload.id), login: String(payload.login) }),
  },
  google: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
    parseIdentity: (payload) => ({ subject: String(payload.sub), login: String(payload.email ?? payload.name ?? payload.sub) }),
  },
  linuxdo: {
    authorizationUrl: "https://connect.linux.do/oauth2/authorize",
    tokenUrl: "https://connect.linux.do/oauth2/token",
    userinfoUrl: "https://connect.linux.do/api/user",
    scopes: ["read"],
    parseIdentity: (payload) => ({ subject: String(payload.id), login: String(payload.username ?? payload.name ?? payload.id) }),
  },
};

function validIdentity(identity: OAuthIdentity): OAuthIdentity {
  if (!identity.subject || identity.subject === "undefined" || !identity.login || identity.login === "undefined") throw new Error("Provider returned an incomplete identity");
  return identity;
}

export function createProvider(config: OAuthProviderConfig): OAuthProvider {
  const definition = definitions[config.id];
  return {
    id: config.id,
    name: config.name,
    authorizeUrl({ redirectUri, state, codeChallenge }) {
      const query = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: definition.scopes.join(" "),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `${definition.authorizationUrl}?${query}`;
    },
    async exchangeCode({ code, redirectUri, codeVerifier }) {
      const tokenResponse = await fetch(definition.tokenUrl, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenResponse.ok) throw new Error("Provider token exchange failed");
      const tokenPayload = await tokenResponse.json() as { access_token?: unknown };
      if (typeof tokenPayload.access_token !== "string") throw new Error("Provider did not return an access token");
      const identityResponse = await fetch(definition.userinfoUrl, { headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: "application/json" } });
      if (!identityResponse.ok) throw new Error("Provider identity request failed");
      return validIdentity(definition.parseIdentity(await identityResponse.json() as Record<string, unknown>));
    },
  };
}
