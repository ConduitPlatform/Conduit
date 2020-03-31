const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {isNil} = require('lodash');
const SALT_ROUNDS = 10;

function generate() {
    return crypto.randomBytes(64).toString('base64');
}

function encode(data, options) {
    if (isNil(data) || isNil(options)) {
        return null;
    }
    if (data instanceof Object && Object.keys(data).length === 0) {
        return null;
    }
    return jwt.sign(data, options.jwtSecret, { expiresIn: options.tokenInvalidationPeriod * 100 });
}

function verify(token, options) {
    try {
        return jwt.verify(token, options.jwtSecret);
    } catch (error) {
        return null;
    }
}

function hashPassword(plainTextPass) {
    return new Promise((resolve, reject) => {
        bcrypt.hash(plainTextPass, SALT_ROUNDS, function (err, hash) {
            if (err) {
                reject(err);
            } else {
                resolve(hash)
            }
        });
    })

}

function checkPassword(password, hashedPassword) {
    return new Promise( (resolve, reject) => {
        bcrypt.compare(password, hashedPassword, (err, result) => {
           if (err) {
               console.log('Could not check password');
               reject(err);
           } else {
               resolve(result);
           }
        });
    });
}

module.exports = {
    generate: generate,
    hashPassword: hashPassword,
    checkPassword: checkPassword,
    encode: encode,
    verify: verify
};
