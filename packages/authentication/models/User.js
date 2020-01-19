const mongoose = require('../db/mongoose');
const Schema = mongoose.Schema;

const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const User = new Schema({
        email: {
            type: String,
            unique: true,
            required: true
        },
        hashedPassword: {
            type: String,
            select: false
        },
        google: {
            token: String,
            tokenExpires: String,
            refreshToken: String,
            refreshTokenExpires: String
        },
        facebook: {
            token: String,
            tokenExpires: String,
            refreshToken: String,
            refreshTokenExpires: String
        },
        active: {
            type: Boolean,
            default: true
        },
        isVerified: {type: Boolean, default: false},
    },
    {
        timestamps: true
    });


User.virtual('password')
    .set(function (password) {
        this["_plainPassword"] = password;
        const self = this;
        bcrypt.hash(password, SALT_ROUNDS, function (err, hash) {
            if (err) {
                console.log(err);
            } else {
                self.hashedPassword = hash;
            }
        });
    })
    .get(function () {
        return this["_plainPassword"];
    });


User.methods.checkPassword = function (password, callback) {
    bcrypt.compare(password, this.hashedPassword, function (err, res) {
        if (err) {
            callback(err);
            console.log('Could not check password');
        } else {
            callback(null, res);
        }
    });
};

module.exports = mongoose.model('User', User);
