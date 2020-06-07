export const verifyEmailTemplate = `
Verify your email for project-26929886976

Message
Hello %DISPLAY_NAME%,

Follow this link to verify your email address.

https://butler-8bef9.firebaseapp.com/__/auth/action?mode=<action>&oobCode=<code>

If you didn’t ask to verify this address, you can ignore this email.

Thanks,

Your project-26929886976 team
`;

export const passwordResetTemplate = `
Hello,

Follow this link to reset your project-26929886976 password for your %EMAIL% account.

https://butler-8bef9.firebaseapp.com/__/auth/action?mode=<action>&oobCode=<code>

If you didn’t ask to reset your password, you can ignore this email.

Thanks,

Your project-26929886976 team
`;

export const emailAddressChange = `
Hello %DISPLAY_NAME%,

Your sign-in email for project-26929886976 was changed to %NEW_EMAIL%.

If you didn’t ask to change your email, follow this link to reset your sign-in email.

https://butler-8bef9.firebaseapp.com/__/auth/action?mode=<action>&oobCode=<code>

Thanks,

Your project-26929886976 team
`;
