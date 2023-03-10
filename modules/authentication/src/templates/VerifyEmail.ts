export const VerifyEmailTemplate = {
  name: 'EmailVerification',
  subject: 'Verify your email',
  body: '<p>Click <a href="{{link}}">here</a> to verify your email</p><p>or use this link: {{link}}</p>',
  variables: ['link'],
};
