import { TemplateOptions } from './interfaces/TemplateOptions';
import { EmailProvider } from "./index"
import { CreateEmailTemplate } from "./interfaces/CreateEmailTemplate";
import { MailgunEmailOptions} from './interfaces/mailgun/MailgunEmailOptions';
import { MandrillEmailOptions } from './interfaces/mandrill/MandrillEmailOptions';
// let provider = new EmailProvider('mailgun',{
//     mailgun:{
//         proxy:null,
//         host: 'api.mailgun.net',
//         domain:'***REMOVED***',
//         apiKey: '***REMOVED***'
//     }
// });

let provider = new EmailProvider('sendgrid',{
    apiKey: '***REMOVED***'
});

// let provider = new EmailProvider('mandrill',{
//     mandrill : { 
//         apiKey: '***REMOVED***'
//     }
// });



let templateOptions:TemplateOptions = {
    id: 'd-56b4d36d208e4b6283e4c02eacedf922',
    variables:[{
        name:'fname',
        content:'safasfasfas'
    }]
}

let mail = provider.emailBuilder()
            .setReceiver("dimitris.soldatos@quintessential.gr")
            .setSubject('Hello ✔✔✔✔✔')           
            .setSender("dimitris.soldatos@quintessential.gr")
            .setTemplate(templateOptions);
          provider
          .sendEmail(mail)
          ?.then( (r) => {
              console.log('Email sent!');
          }) 
          .catch( (err) => {
              console.log('err',err);
          });

// const data: CreateSendgridTemplate =  {
//     name: " my templatessssasfasfagsdfgdfgdgdfsssss",
//     generation:'dynamic',
//     version: {
//         subject: 'xaxaasdasxa',
//         name: 'first vesasrsion',
//         html_content:' <p> gia afasfas psixoula m </p>'
//     }
// }

// var mailgundata: CreateEmailTemplate = {
//     name : "psixoulammmmmmm",
//     subject: " afasfasfasfa",
//     plainContent: " <p> hi you {{test}} {{fff}} </p>",

// };
// var mandrilData = {
//     subject: 'xd',
//     name:'third template',
//     code: '<p> xixi xd </p>',
//     text:'edw to text',
    

// }
// provider._transport?.sendEmail().then((body:any)  => {
//     console.log(body);
// })
// .catch(err => {
//     console.log(err);
// })

// provider._transport?.getTemplateInfo('ffff').then(res =>{
    //     console.log(res);
    // })
    // .catch(err => {
        //     console.log(err);
        // });
        //     console.log(body);
// })
// .catch( (err:any) => {
//     console.log(err);
// });
//sendgrid api key ***REMOVED***