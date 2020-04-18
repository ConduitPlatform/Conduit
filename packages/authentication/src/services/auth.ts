import * as crypto from 'crypto';
import {ISignTokenOptions} from '../interfaces/ISignTokenOptions';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

export class AuthService {
    constructor() {
    }

    randomToken() {
        return crypto.randomBytes(64).toString('base64');
    }

    signToken(data: { [key: string]: any }, options: ISignTokenOptions) {
        const {secret, expiresIn} = options;
        return jwt.sign(data, secret, {expiresIn});
    }

    verify(token: string, secret: string): any {
        try {
            return jwt.verify(token, secret);
        } catch (error) {
            return null;
        }
    }

    async hashPassword(password: string, hashRounds = 10) {
        return bcrypt.hash(password, hashRounds);
    }

    async checkPassword(password: string, hashed: string) {
        return bcrypt.compare(password, hashed);
    }
}
