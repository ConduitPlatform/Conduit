export * from './CreateEmailTemplate.js';
export * from './DeleteEmailTemplate.js';
export * from './EmailBuilder.js';
export * from './EmailOptions.js';
export * from './EmailSendTransport.js';
export * from './Template.js';
export * from './TemplateDocument.js';
export * from './TemplateOptions.js';
export * from './UpdateEmailTemplate.js';
export * from './Var.js';

// Amazon SES
export * from './amazonSes/AmazonSesEmailOptions.js';

// Mailgun
export * from './mailgun/MailgunEmailOptions.js';
export { MailgunTemplate } from './mailgun/MailgunTemplate.js';

// Mandrill
export * from './mandrill/MandrillEmailOptions.js';
export { MandrillTemplate } from './mandrill/MandrillTemplate.js';

// SendGrid
export * from './sendgrid/SendgridEmailOptions.js';
export { SendgridTemplate } from './sendgrid/SendgridTemplate.js';
