async function register(req, res, next) {
    res.send("Hello  world");
}

async function authenticate(req, res, next) {
    res.send("Hello  world");
}


module.exports.authenticate = authenticate;
module.exports.register = register;
