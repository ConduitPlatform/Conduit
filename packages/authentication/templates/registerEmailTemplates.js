async function registerEmailTemplates(emailProvider) {
  await emailProvider.registerTemplate(
      {
        name: 'ForgotPassword',
        subject: '{{applicationName}} - Forgot Password',
        body: 'Click <a href="{{link}}">here</a> to reset your password',
        variables: ['applicationName', 'link']
      });

  await emailProvider.registerTemplate(
      {
        name: 'EmailVerification',
        subject: '{{applicationName}} - Verify your email',
        body: 'Click <a href="{{link}}">here</a> to verify your email',
        variables: ['applicationName', 'link']
      });
}

module.exports = registerEmailTemplates;
