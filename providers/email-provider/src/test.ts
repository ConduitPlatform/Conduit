console.log('edw pera sto import sto email provider test');
import { EmailProvider } from "./index";

let provider = new EmailProvider('mandrill',{
    port: 587,
    host:'conduit.com',
    mandrill:{
        apiKey: '***REMOVED***',
        serverPrefix: ''
    }
});
let mailOptions={
    from : 'dimitrissoldatos2@gmail.com',
    to : 'dimitrissoldatos2@gmail.com',
    subject : "This is from Mandrill",
    text: 'Hello world?', // plain text body
 };

 provider.sendEmailDirect(mailOptions as any ).then((r)=> {
     console.log('DOne');
 })
 .catch( (err) => {
     console.log(err);
 })
