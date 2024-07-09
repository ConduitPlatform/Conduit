export const VerifyEmailWithCodeTemplate = {
  name: 'EmailVerificationWithCode',
  subject: 'Verify your email',
  body: '<p>Your verification code is {{code}}. Please use this in the app to verify your email. The code expires in 2 minutes.</p>',
  variables: ['code'],
};
