/** Claims carried by a short-lived Ed25519-signed access token ("jwt" session mode). */
export interface AccessTokenClaims {
  sub: string;
  sid: string;
  cid: string;
  rid?: string;
  realm?: string;
  home?: string;
  rtype?: 'home' | 'guest';
  authorized: boolean;
  sudo: boolean;
  tv: number;
  teams?: { id: string; role: string }[];
  teamsTruncated?: boolean;
  iat: number;
  exp: number;
  iss: string;
}
