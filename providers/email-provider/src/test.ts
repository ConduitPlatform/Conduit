import { EmailProvider } from "./index";
import { MandrillEmailOptions } from "./interfaces/MandrillEmailOptions";
import { MailgunMailBuilder } from "./transports/mailgun/mailgunMailBuilder";
import { MandrillBuilder } from "./transports/mandrill/mandrillBuilder";
let provider = new EmailProvider('sendgrid',{
    apiKey: process.env.SENDGRID_API_KEY,
    
});
// let mailOptions: MandrillEmailOptions = {
//     to: [{ 
//         address: "dimitrissoldatos2@md.quintessential.gr",
//         name: "dim"
//     }],
//     mandrillOptions:{
//             template_name: 'first-template',
//             template_content: [],
//             message: {
//                 merge: true,
//                 merge_language: "handlebars",
//                 global_merge_vars: [{
//                     name: "fname",
//                     content: "John"
//                 },
//             ]
//         }
//     }
// };
let mail = (provider.emailBuilder())
            .setReceiver("dimitris.soldatos@quintessential.gr")
            .setSubject('Hello ✔')           
            .setSender("dimitris.soldatos@quintessential.gr")
            .setContent("sdfasdfsd");
          provider
          .sendEmail(mail)
          .then( (r) => {
              console.log('done',r);
          }) 
          .catch( (err) => {
              console.log('err',err);
          });