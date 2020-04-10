export const VerifyEmailTemplate = {
  name: 'EmailVerification',
  subject: '{{applicationName}} - Verify your email',
  body: 'Click <a href="{{link}}">here</a> to verify your email',
  variables: ['applicationName', 'link']
};
