async function registerEmailTemplates(emailProvider) {
  await emailProvider.registerTemplate(
    'ForgotPassword',
    '{{applicationName}} - Forgot Password',
    'Click <a href="{{link}}">here</a> to reset your password',
    ['applicationName', 'link']);

  await emailProvider.registerTemplate(
    'EmailVerification',
    '{{applicationName}} - Verify your email',
    'Click <a href="{{link}}">here</a> to verify your email',
    ['applicationName', 'link']
  );
}

module.exports = registerEmailTemplates;
