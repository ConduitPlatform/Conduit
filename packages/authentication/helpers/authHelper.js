const crypto = require('crypto');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

function generate() {
    return crypto.randomBytes(64).toString('hex');

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
};
