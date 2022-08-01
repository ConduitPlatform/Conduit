import twoFactor from 'node-2fa';

export class TwoFactorAuth {
  static generateSecret(options?: { name: string; account: string }) {
    return twoFactor.generateSecret(options);
  }

  static generateToken(secret: string) {
    return twoFactor.generateToken(secret);
  }

  static verifyToken(secret: string, token?: string, window?: number) {
    return twoFactor.verifyToken(secret, token, window);
  }
}
