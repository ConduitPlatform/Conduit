import { EmailProvider } from "./index";
import { MandrillEmailOptions } from "./interfaces/MandrillEmailOptions";
import { MandrillBuilder } from "./transports/mandrill/mandrillBuilder";
let provider = new EmailProvider('mandrill',{
    port: 587,
    host:'smtp.mandrillapp.com',
    mandrill:{
        apiKey: '***REMOVED***',
        serverPrefix: ''
    }
});
let mailOptions: MandrillEmailOptions = {
    to: [{ 
        address: "dimitrissoldatos2@md.quintessential.gr",
        name: "dim"
    }],
    mandrillOptions:{
            template_name: 'first-template',
            template_content: [],
            message: {
                merge: true,
                merge_language: "handlebars",
                global_merge_vars: [{
                    name: "fname",
                    content: "John"
                },
            ]
        }
    }
};
let mail = (provider.emailBuilder() as MandrillBuilder)
            .setReceiver("dimitrissoldatos2@md.quintessential.gr")
            .setSubject('Hello ✔')           
            .setSender("dimitrissoldatos2@md.quintessential.gr");
    
        (mail as MandrillBuilder).
        setTemplateName('first-template')
        .setTemplateContent()
        .setTemplateMessage(mailOptions.mandrillOptions.message.global_merge_vars);

          provider
          .sendEmail(mail)
          .then( (r) => {
              console.log('done',r);
          }) 
          .catch( (err) => {
              console.log('err',err);
          });