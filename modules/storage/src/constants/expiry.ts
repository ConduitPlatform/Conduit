// 60 minutes
export const SIGNED_URL_EXPIRY = 3600 * 1000;
export const SIGNED_URL_EXPIRY_DATE = () => Date.now() + SIGNED_URL_EXPIRY;
export const SIGNED_URL_EXPIRY_SECONDS = SIGNED_URL_EXPIRY / 1000;
