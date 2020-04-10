export const ForgotPasswordTemplate = {
  name: 'ForgotPassword',
  subject: '{{applicationName}} - Forgot Password',
  body: 'Click <a href="{{link}}">here</a> to reset your password',
  variables: ['applicationName', 'link']
};
