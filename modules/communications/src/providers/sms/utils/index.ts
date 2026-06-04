import { generate } from 'otp-generator';

export function generateToken(): string {
  return generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
}
