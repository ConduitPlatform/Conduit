"use strict";

const Mongoose = require("mongoose").Mongoose;
const mongoose = new Mongoose();
const options = {
    autoReconnect: true,
    keepAlive: 1,
    connectTimeoutMS: 30000,
    useNewUrlParser: true,
    useCreateIndex: true
};

let MAX_TRIES = 5;
mongoose.Promise = require("bluebird");

const connectWithRetry = () => {
    mongoose
        .connect(process.env.MONGO_CONNECTION_STRING, options)
        .then(() => {
            console.log('MongoDB dashboard is connected');
            let db = mongoose.connection;

            db.on('error', function (err) {
                console.error('Dashboard Connection error:', err.message);
            });

            db.once('open', function callback() {
                console.info("Connected to Dashboard Database!");
            });

            db.on('reconnected', function () {
                console.log('Dashboard Database reconnected!');
            });

            db.on('disconnected', function () {
                console.log('Dashboard Database Disconnected');

            });
        })
        .catch(err => {
            console.log(err);
            console.log('MongoDB connection unsuccessful, retry after 2 seconds.');
            if (MAX_TRIES !== 0) {
                MAX_TRIES--;
                setTimeout(connectWithRetry, 5000);
            } else {
                throw new Error("Connection with Mongo not possible")
            }
        });
};

connectWithRetry();

module.exports = mongoose;
