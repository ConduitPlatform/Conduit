import { EmailProvider } from "./index"
import { CreateSendgridTemplate } from "./interfaces/sendgrid/CreateSendgridTemplate";
let provider = new EmailProvider('sendgrid',{
    apiKey: '***REMOVED***'
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
// let mail = provider.emailBuilder()
//             .setReceiver("dimitris.soldatos@quintessential.gr")
//             .setSubject('Hello ✔')           
//             .setSender("dimitris.soldatos@quintessential.gr")
//             .setContent("AFSAasfasfasfaFAS");

//           provider
//           .sendEmail(mail)
//           ?.then( (r) => {
//               console.log('Email sent!');
//           }) 
//           .catch( (err) => {
//               console.log('err',err);
//           });

// const data: CreateSendgridTemplate =  {
//     name: " my template",
//     generation:'dynamic',
//     version: {
//         subject: 'xaxasxa',
//         name: 'first version',
//         html_content:' <p> gia s psixoula m </p>'
//     }
// }
// provider._transport?.createTemplate(data);


//sendgrid api key ***REMOVED***