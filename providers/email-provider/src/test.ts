import { EmailProvider } from "./index";
import { MandrillEmailOptions } from "./interfaces/MandrillEmailOptions";
import { MailgunMailBuilder } from "./transports/mailgun/mailgunMailBuilder";
import { MandrillBuilder } from "./transports/mandrill/mandrillBuilder";
let provider = new EmailProvider('mailgun',{
    mailgun:{
        apiKey: '***REMOVED***',
        proxy: null,
        host:'api.mailgun.net',
        domain:'***REMOVED***'
    }
    
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
let mail = (provider.emailBuilder() as MailgunMailBuilder)
            .setTemplate({
                template: 'first_template',
                'v:fname': 'fffffff'
                })
            .setReceiver("dimitrissoldatos2@gmail.com")
            .setSubject('Hello ✔')           
            .setSender("postmaster@***REMOVED***");

          provider
          .sendEmail(mail)
          .then( (r) => {
              console.log('done',r);
          }) 
          .catch( (err) => {
              console.log('err',err);
          });