const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SALT_ROUNDS = 10;

function generate() {
    return crypto.randomBytes(64).toString('base64');
}

function encode(data) {
    if (data === null || data === undefined) {
        return null;
    }
    if (data instanceof Object && Object.keys(data).length === 0) {
        return null;
    }
    return jwt.sign(data, process.env.jwtSecret, { expiresIn: Number(process.env.tokenInvalidationPeriod) * 100 });
}

function verify(token) {
    try {
        return jwt.verify(token, process.env.jwtSecret);
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

function checkPassword(password, callback) {
    bcrypt.compare(password, this.hashedPassword, function (err, res) {
        if (err) {
            callback(err);
            console.log('Could not check password');
        } else {
            callback(null, res);
        }
    });
}

module.exports = {
    generate: generate,
    hashPassword: hashPassword,
    checkPassword: checkPassword,
    encode: encode,
    verify: verify
};
