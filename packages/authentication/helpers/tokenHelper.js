const crypto = require('crypto');

function generate() {
    return crypto.randomBytes(64).toString('hex');

}

module.exports = {
    generate: generate
};
