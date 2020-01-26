const winston = require('winston'),
    expressWinston = require('express-winston');


function middleware() {
    return expressWinston.logger({
        transports: [
            new winston.transports.Console()
        ],
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.json()
        ),
        meta: true,
        msg: "HTTP {{req.method}} {{req.url}}",
        expressFormat: true,
        colorize: false
    })
}

function errorLogger() {
    return expressWinston.errorLogger({
        transports: [
            new winston.transports.Console()
        ],
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.json()
        )
    });
}

module.exports = {logger: middleware, errorLogger: errorLogger};
