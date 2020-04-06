const describe = require("mocha").describe;
const chai = require('chai');
process.env.NODE_ENV = 'test';
const chaiHttp = require('chai-http');
const should = chai.should();

const server = require('../bin/www');

chai.use(chaiHttp);

describe('Core Test', function () {
    before(function (done) {
        let interval = setInterval(() => {
            console.log("Waiting for conduit to init");
            chai.request(server)
                .get('/health')
                .end((err, res) => {
                    if (!err && res.status !== 500) {
                        res.should.have.status(200);
                        clearInterval(interval);
                        done();
                    }

                });
        }, 500)
    });

    describe('Server is online', function () {
        it('should return 200 on index route', function (done) {
            chai.request(server)
                .get('/')
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });
});
