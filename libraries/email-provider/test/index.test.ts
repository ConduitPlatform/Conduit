import * as nodemailer from "nodemailer";
import {EmailProvider} from "../src";
import {expect} from "chai";

let testAccount: any;

describe('Email provider Tests', function () {

    before(async () => {
        testAccount = await nodemailer.createTestAccount();
        return;
    });

    describe('Constructor test', () => {
        it('should create provider', function (done) {
            let provider = new EmailProvider('smtp', {
                host: 'smtp.ethereal.email',
                port: 587
            }, {
                user: testAccount.user,
                pass: testAccount.pass
            });
            done();
        });

        it('should send an email', function (done) {
            let provider = new EmailProvider('smtp', {
                host: 'smtp.ethereal.email',
                port: 587
            }, {
                user: testAccount.user,
                pass: testAccount.pass
            });

            provider
                .sendEmailDirect({
                    from: testAccount.user, // sender address
                    to: testAccount.user, // list of receivers
                    subject: "Hello ✔", // Subject line
                    text: "Hello world?", // plain text body
                    html: "<b>Hello world?</b>" // html body
                })
                .then(r => {
                    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(r));
                    done();
                })
                .catch(err => {
                    done(err);
                });
        });
    });

    describe('Generic Email Builder test', () => {
        let provider: EmailProvider;
        before((done) => {
            provider = new EmailProvider('smtp', {
                host: 'smtp.ethereal.email',
                port: 587
            }, {
                user: testAccount.user,
                pass: testAccount.pass
            });
            expect(provider).to.not.equal(undefined);
            done();
        });
        it('should create a builder', function (done) {
            expect(provider.emailBuilder()).to.not.equal(undefined);
            done();
        });

        it('should create an email with the builder', function (done) {
            let mail = provider.emailBuilder()
                .setReceiver(testAccount.user)
                .setSubject("Hello ✔")
                .setSender(testAccount.user)
                .setContent("<b>Hello world?</b>")
                .getMailObject();
            expect(mail).to.deep.equal({
                from: testAccount.user,
                to: testAccount.user,
                subject: 'Hello ✔',
                html: '<b>Hello world?</b>'
            });
            done();
        });

        it('should send an email with the builder', function (done) {
            let builder = provider.emailBuilder()
                .setReceiver(testAccount.user)
                .setSubject("Hello ✔")
                .setSender(testAccount.user)
                .setContent("<b>Hello world?</b>");
            provider.sendEmail(builder)
                .then(r => {
                    expect(r).to.not.equal(null);
                    done();
                })
                .catch(err => {
                    done(err);
                });
        });
    })
});
