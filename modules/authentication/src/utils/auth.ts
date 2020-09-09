import * as crypto from 'crypto';
import {ISignTokenOptions} from '../interfaces/ISignTokenOptions';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

export namespace AuthUtils {

    export function randomToken() {
        return crypto.randomBytes(64).toString('base64');
    }

    export function signToken(data: { [key: string]: any }, options: ISignTokenOptions) {
        const {secret, expiresIn} = options;
        return jwt.sign(data, secret, {expiresIn});
    }

    export function verify(token: string, secret: string): any {
        try {
            return jwt.verify(token, secret);
        } catch (error) {
            return null;
        }
    }

    export async function hashPassword(password: string, hashRounds = 10) {
        return bcrypt.hash(password, hashRounds);
    }

    export async function checkPassword(password: string, hashed: string) {
        return bcrypt.compare(password, hashed);
    }
}
