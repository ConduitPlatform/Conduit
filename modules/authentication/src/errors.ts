import { status } from '@grpc/grpc-js';
import { ModuleErrorDefinition } from '@conduitplatform/grpc-sdk';

export const errors = {
  // realms and invitations (original catalog)
  USER_EXISTS: {
    conduitCode: 'USER_EXISTS',
    grpcCode: status.ALREADY_EXISTS,
    message: 'User already exists',
    description: 'A user with this email already exists',
  },
  INVITATION_REQUIRED: {
    conduitCode: 'INVITATION_REQUIRED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Registration requires invitation',
    description: 'Registration is only allowed with an invitation',
  },
  INVALID_INVITATION: {
    conduitCode: 'INVALID_INVITATION',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Invalid invitation token',
    description: 'The provided invitation token is invalid',
  },
  EMAIL_NOT_ALLOWED: {
    conduitCode: 'EMAIL_NOT_ALLOWED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'This email address is not allowed',
    description: 'The provided email address is blocked by email restrictions',
  },
  REGISTRATION_NOT_ALLOWED: {
    conduitCode: 'REGISTRATION_NOT_ALLOWED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'User registration is not allowed for this request',
    description:
      'OAuth was started in sign-in-only mode and no existing user was found. Invitation tokens still allow registration.',
  },
  REALM_NOT_FOUND: {
    conduitCode: 'REALM_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'Realm not found',
    description: 'The requested realm does not exist or is not active',
  },
  REALM_SLUG_TAKEN: {
    conduitCode: 'REALM_SLUG_TAKEN',
    grpcCode: status.ALREADY_EXISTS,
    message: 'Realm slug is already in use',
    description: 'Another realm already uses this slug',
  },
  REALM_HAS_HOME_USERS: {
    conduitCode: 'REALM_HAS_HOME_USERS',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Realm still has home users',
    description:
      'The realm cannot be demoted or deleted while it has home users, unless forced',
  },
  REALM_NESTED: {
    conduitCode: 'REALM_NESTED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Realms cannot be nested',
    description:
      'A realm must be a top-level team and cannot contain or sit inside another realm',
  },
  GUESTS_NOT_ALLOWED: {
    conduitCode: 'GUESTS_NOT_ALLOWED',
    grpcCode: status.PERMISSION_DENIED,
    message: "This realm does not allow guests from this user's home realm",
    description: 'The realm guest policy rejects the user',
  },
  LINK_CONFLICT: {
    conduitCode: 'LINK_CONFLICT',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'The account conflicts with an account of this realm',
    description:
      'The realm already has a home account or a linked guest holding one of the identifiers (email, phone, username, wallet or provider id) of the account. Each realm has at most one principal per identifier.',
  },
  LINKING_NOT_ALLOWED: {
    conduitCode: 'LINKING_NOT_ALLOWED',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Account linking is not allowed between these realms',
    description:
      'The target realm does not accept linked accounts (linking.inbound) or the source realm does not allow them to leave (linking.outbound)',
  },
  ACCOUNT_LINK_AVAILABLE: {
    conduitCode: 'ACCOUNT_LINK_AVAILABLE',
    grpcCode: status.ALREADY_EXISTS,
    message: 'An account of another realm can be connected to this realm',
    description:
      'The identifier is held by an account of another realm and this realm accepts linked accounts. Connect that account instead of registering a new one.',
  },
  INVALID_LINK_PROOF: {
    conduitCode: 'INVALID_LINK_PROOF',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid or expired link proof',
    description:
      'The proof token is unknown, expired or already used, or no source account is authenticated for the link',
  },
  HOME_USER_REMOVAL: {
    conduitCode: 'HOME_USER_REMOVAL',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Home users cannot be removed from their home realm',
    description: 'Block, delete or move the user to another home realm instead',
  },
  REALMS_DISABLED: {
    conduitCode: 'REALMS_DISABLED',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Realms are disabled',
    description: 'The teams.realms.enabled configuration flag is off',
  },
  REALM_ACCESS_DENIED: {
    conduitCode: 'REALM_ACCESS_DENIED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Access to this realm is denied',
    description:
      'The user is not allowed to enter this realm or does not satisfy its policies',
  },
  TWO_FA_REQUIRED_FOR_REALM: {
    conduitCode: 'TWO_FA_REQUIRED_FOR_REALM',
    grpcCode: status.PERMISSION_DENIED,
    message: 'This realm requires two-factor authentication',
    description:
      'The user must enable and pass two-factor authentication to enter this realm',
  },
  STRATEGY_NOT_AVAILABLE_FOR_REALM: {
    conduitCode: 'STRATEGY_NOT_AVAILABLE_FOR_REALM',
    grpcCode: status.PERMISSION_DENIED,
    message: 'This authentication strategy is not available for this realm',
    description: 'The realm has not enabled the requested authentication strategy',
  },

  // Credentials and login

  INVALID_CREDENTIALS: {
    conduitCode: 'INVALID_CREDENTIALS',
    grpcCode: status.UNAUTHENTICATED,
    message: 'Invalid login credentials',
    description:
      'The identifier, password or proof is wrong, or the account may not sign in here; the reason is deliberately not disclosed',
  },
  PASSWORD_AUTH_NOT_AVAILABLE: {
    conduitCode: 'PASSWORD_AUTH_NOT_AVAILABLE',
    grpcCode: status.PERMISSION_DENIED,
    message: 'User does not use password authentication',
    description:
      'This account has no password; sign in with the method it was registered with',
  },
  ACCOUNT_NOT_VERIFIED: {
    conduitCode: 'ACCOUNT_NOT_VERIFIED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'You must verify your account to login',
    description: 'The account must be verified before it can sign in',
  },
  AUTHENTICATION_REQUIRED: {
    conduitCode: 'AUTHENTICATION_REQUIRED',
    grpcCode: status.UNAUTHENTICATED,
    message: 'Authentication required',
    description: 'The request is not authenticated; sign in and retry',
  },
  ANONYMOUS_USER_NOT_ELIGIBLE: {
    conduitCode: 'ANONYMOUS_USER_NOT_ELIGIBLE',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Anonymous users are not allowed to perform this action',
    description:
      'Anonymous accounts cannot use this operation; sign in with a full account',
  },
  // was a plain Error (INTERNAL)
  ANONYMOUS_USERS_DISABLED: {
    conduitCode: 'ANONYMOUS_USERS_DISABLED',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Anonymous users configuration is disabled',
    description: 'Anonymous users are turned off in the authentication configuration',
  },
  ANONYMOUS_USER_NOT_FOUND: {
    conduitCode: 'ANONYMOUS_USER_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'Anonymous user not found',
    description: 'The anonymous user to convert does not exist',
  },
  STRATEGY_DISABLED: {
    conduitCode: 'STRATEGY_DISABLED',
    grpcCode: status.NOT_FOUND,
    message: 'Requested resource not found',
    description: 'This authentication strategy is not enabled',
  },

  // Users

  USER_NOT_FOUND: {
    conduitCode: 'USER_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'User not found',
    description: 'No user matches the given identifier',
  },
  USER_ALREADY_BLOCKED: {
    conduitCode: 'USER_ALREADY_BLOCKED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'User is already blocked',
    description: 'The user is already blocked',
  },
  USER_ALREADY_ACTIVE: {
    conduitCode: 'USER_ALREADY_ACTIVE',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'User is already active',
    description: 'The user is already active',
  },
  USER_IDS_REQUIRED: {
    conduitCode: 'USER_IDS_REQUIRED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'A non-empty list of user ids is required',
    description: 'Provide at least one user id',
  },
  USER_IDS_INVALID: {
    conduitCode: 'USER_IDS_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'The list contains invalid user ids',
    description: 'Some of the given ids do not belong to existing users',
  },
  USER_ID_INVALID: {
    conduitCode: 'USER_ID_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'userId must be a valid User ID',
    description: 'The given userId is not a valid user id',
  },
  USER_IDENTIFIER_INVALID: {
    conduitCode: 'USER_IDENTIFIER_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Exactly one of email or username must be provided',
    description: 'Provide either an email or a username, not both and not neither',
  },
  USER_DATA_INVALID: {
    conduitCode: 'USER_DATA_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'User data cannot overwrite User schema fields',
    description: 'The custom user data uses keys that collide with built-in user fields',
  },
  USER_EMAIL_INVALID: {
    conduitCode: 'USER_EMAIL_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid email address provided',
    description: 'The given email address is empty or not a valid address',
  },
  USER_EMAIL_UNCHANGED: {
    conduitCode: 'USER_EMAIL_UNCHANGED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'The new email can not be the same as the old email',
    description: 'The new email address must differ from the current one',
  },
  // admin patchUser used INVALID_ARGUMENT
  USER_EMAIL_TAKEN: {
    conduitCode: 'USER_EMAIL_TAKEN',
    grpcCode: status.ALREADY_EXISTS,
    message: 'Email address already taken',
    description: 'Another account already uses this email address',
  },
  PHONE_NUMBER_TAKEN: {
    conduitCode: 'PHONE_NUMBER_TAKEN',
    grpcCode: status.ALREADY_EXISTS,
    message: 'Phone number already exists',
    description: 'Another account already uses this phone number',
  },
  PHONE_NUMBER_REQUIRED_FOR_2FA: {
    conduitCode: 'PHONE_NUMBER_REQUIRED_FOR_2FA',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Can not enable 2fa without a phone number',
    description:
      'The user needs a phone number before SMS two-factor authentication can be enabled',
  },
  IDENTIFIER_HELD_BY_MULTIPLE_ACCOUNTS: {
    conduitCode: 'IDENTIFIER_HELD_BY_MULTIPLE_ACCOUNTS',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Identifier is held by more than one account; pass realm',
    description: 'Several realms hold an account with this identifier; specify the realm',
  },
  USER_DOCUMENT_TOO_LARGE: {
    conduitCode: 'USER_DOCUMENT_TOO_LARGE',
    grpcCode: status.INTERNAL,
    message: 'User document is too large',
    description: 'The user record exceeds the maximum size that can be returned',
  },

  // Password and email verification

  PASSWORD_UNCHANGED: {
    conduitCode: 'PASSWORD_UNCHANGED',
    grpcCode: status.PERMISSION_DENIED,
    message: "Password can't be the same as the old one",
    description: 'The new password must differ from the current one',
  },
  PASSWORD_RESET_TOKEN_INVALID: {
    conduitCode: 'PASSWORD_RESET_TOKEN_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid parameters',
    description: 'The password reset token is unknown or expired; request a new one',
  },
  USER_ALREADY_VERIFIED: {
    conduitCode: 'USER_ALREADY_VERIFIED',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'User already verified',
    description: 'The account is already verified',
  },
  VERIFICATION_TOKEN_NOT_FOUND: {
    conduitCode: 'VERIFICATION_TOKEN_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'Verification token not found',
    description:
      'The verification or change-email token is unknown or expired; request a new one',
  },
  CHANGE_EMAIL_TOKEN_MALFORMED: {
    conduitCode: 'CHANGE_EMAIL_TOKEN_MALFORMED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Change email token is malformed',
    description: 'The change-email token carries no target email address',
  },
  VERIFICATION_CODE_INVALID: {
    conduitCode: 'VERIFICATION_CODE_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid verification code',
    description: 'The submitted verification or authenticator code is incorrect',
  },
  VERIFICATION_DISABLED: {
    conduitCode: 'VERIFICATION_DISABLED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Email verification is disabled. Configuration required.',
    description: 'Email verification was requested but is not configured',
  },
  // was INTERNAL
  VERIFICATION_UNAVAILABLE: {
    conduitCode: 'VERIFICATION_UNAVAILABLE',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Cannot use verification at this time',
    description:
      'Verification cannot be used right now because its configuration is incomplete',
  },
  AUTH_EMAIL_DELIVERY_FAILED: {
    conduitCode: 'AUTH_EMAIL_DELIVERY_FAILED',
    grpcCode: status.INTERNAL,
    message: 'There was an error sending the email. Please try again later.',
    description: 'The email could not be sent; try again later',
  },

  // Phone and SMS verification

  VERIFICATION_CODE_SEND_FAILED: {
    conduitCode: 'VERIFICATION_CODE_SEND_FAILED',
    grpcCode: status.INTERNAL,
    message: 'Could not send verification code',
    description: 'The verification code could not be sent; try again later',
  },
  VERIFICATION_RESEND_THROTTLED: {
    conduitCode: 'VERIFICATION_RESEND_THROTTLED',
    grpcCode: status.RESOURCE_EXHAUSTED,
    message: 'Verification not sent. Please wait before trying again',
    description: 'A verification code was sent recently; wait before requesting another',
  },
  PHONE_PROVIDER_UNAVAILABLE: {
    conduitCode: 'PHONE_PROVIDER_UNAVAILABLE',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'SMS module not available',
    description: 'The SMS service is not available; try again later',
  },
  PHONE_TOKEN_INVALID: {
    conduitCode: 'PHONE_TOKEN_INVALID',
    grpcCode: status.UNAUTHENTICATED,
    message: 'Invalid token provided',
    description: 'The phone verification token is unknown or expired',
  },
  CODE_VERIFICATION_FAILED: {
    conduitCode: 'CODE_VERIFICATION_FAILED',
    grpcCode: status.UNAUTHENTICATED,
    message: 'Code verification unsuccessful',
    description: 'The submitted code was rejected',
  },
  PHONE_VERIFICATION_NOT_FOUND: {
    conduitCode: 'PHONE_VERIFICATION_NOT_FOUND',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'No verification record for this user',
    description: 'No phone verification is pending for this user',
  },

  // Two-factor authentication

  TWO_FA_METHOD_INVALID: {
    conduitCode: 'TWO_FA_METHOD_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Method not valid',
    description: 'The requested two-factor method is unknown or disabled',
  },
  TWO_FA_METHOD_UNAVAILABLE: {
    conduitCode: 'TWO_FA_METHOD_UNAVAILABLE',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'User 2FA method is not valid',
    description: 'The two-factor method of this user cannot be used for this operation',
  },
  TOTP_SECRET_NOT_FOUND: {
    conduitCode: 'TOTP_SECRET_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'Verification unsuccessful',
    description: 'No authenticator secret is set up for this user',
  },
  TOTP_ISSUER_NOT_ALLOWED: {
    conduitCode: 'TOTP_ISSUER_NOT_ALLOWED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Issuer is not allowed',
    description: 'The authenticator issuer name is not permitted',
  },
  BACKUP_CODE_FORMAT_INVALID: {
    conduitCode: 'BACKUP_CODE_FORMAT_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Incorrect code format',
    description: 'A backup code consists of 8 digits',
  },
  BACKUP_CODES_NOT_FOUND: {
    conduitCode: 'BACKUP_CODES_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'User has no back up codes',
    description: 'No backup codes exist for this user',
  },
  BACKUP_CODE_INVALID: {
    conduitCode: 'BACKUP_CODE_INVALID',
    grpcCode: status.UNAUTHENTICATED,
    message: 'Invalid code',
    description: 'The backup code does not match',
  },

  // Sudo (step-up authentication)

  SUDO_REQUIRED: {
    conduitCode: 'SUDO_REQUIRED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Re-login required to enter sudo mode',
    description:
      'This operation needs a sudo access token; re-authenticate to obtain one',
  },
  STEP_UP_UNAVAILABLE: {
    conduitCode: 'STEP_UP_UNAVAILABLE',
    grpcCode: status.UNAVAILABLE,
    message: 'Step-up authentication is unavailable',
    description: 'Step-up authentication cannot be performed right now; retry shortly',
  },
  SUDO_PASSWORD_REQUIRED: {
    conduitCode: 'SUDO_PASSWORD_REQUIRED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'A password is required',
    description: 'Entering sudo mode requires the account password',
  },
  SUDO_CODE_REQUIRED: {
    conduitCode: 'SUDO_CODE_REQUIRED',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'A 2FA code is required',
    description: 'Entering sudo mode requires a two-factor code',
  },
  SUDO_LOCKED_OUT: {
    conduitCode: 'SUDO_LOCKED_OUT',
    grpcCode: status.RESOURCE_EXHAUSTED,
    message: 'Too many failed attempts',
    description:
      'Too many failed sudo attempts; wait before trying again (the message states how long)',
  },

  // Magic link

  MAGIC_LINK_TOKEN_NOT_FOUND: {
    conduitCode: 'MAGIC_LINK_TOKEN_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'Magic link token does not exist',
    description: 'The magic link is unknown, expired or already used; request a new one',
  },
  REDIRECT_URI_NOT_ALLOWED: {
    conduitCode: 'REDIRECT_URI_NOT_ALLOWED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Invalid redirectUri provided',
    description: 'The redirect URI is not on the allowed list',
  },

  // Biometric

  BIOMETRIC_SIGNATURE_INVALID: {
    conduitCode: 'BIOMETRIC_SIGNATURE_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid signature!',
    description:
      'The biometric challenge or signature was rejected; the reason is deliberately not disclosed',
  },
  BIOMETRIC_CLIENT_MISMATCH: {
    conduitCode: 'BIOMETRIC_CLIENT_MISMATCH',
    grpcCode: status.PERMISSION_DENIED,
    message: "Responding client doesn't match requesting!",
    description: 'The challenge was issued to a different client',
  },
  BIOMETRIC_CHALLENGE_UNAVAILABLE: {
    conduitCode: 'BIOMETRIC_CHALLENGE_UNAVAILABLE',
    grpcCode: status.UNAVAILABLE,
    message: 'Unable to issue biometric challenge',
    description: 'A biometric challenge could not be issued; retry shortly',
  },

  // Metamask

  WALLET_ADDRESS_NOT_FOUND: {
    conduitCode: 'WALLET_ADDRESS_NOT_FOUND',
    grpcCode: status.UNAUTHENTICATED,
    message: 'No user found with the provided ETH public address',
    description: 'No account is registered for this wallet address',
  },
  WALLET_SIGNATURE_INVALID: {
    conduitCode: 'WALLET_SIGNATURE_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid signature format',
    description: 'The signature is not a valid wallet signature',
  },
  WALLET_SIGNATURE_REJECTED: {
    conduitCode: 'WALLET_SIGNATURE_REJECTED',
    grpcCode: status.UNAUTHENTICATED,
    message: 'Signature does not match public address',
    description: 'The signature was not produced by the given wallet address',
  },

  // OAuth

  OAUTH_STATE_INVALID: {
    conduitCode: 'OAUTH_STATE_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid or expired OAuth state',
    description: 'The OAuth state token is unknown or expired; restart the sign-in',
  },
  OAUTH_MODE_INVALID: {
    conduitCode: 'OAUTH_MODE_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'mode must be "signIn" or "both"',
    description: 'The OAuth mode must be signIn or both',
  },
  OAUTH_PROVIDER_AUTH_FAILED: {
    conduitCode: 'OAUTH_PROVIDER_AUTH_FAILED',
    grpcCode: status.UNAUTHENTICATED,
    message: 'Authentication with the provider failed',
    description: 'The identity provider did not return a usable identity',
  },
  OAUTH_PROFILE_INCOMPLETE: {
    conduitCode: 'OAUTH_PROFILE_INCOMPLETE',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'No email or id received from provider',
    description: 'The identity provider returned no email or id',
  },
  OAUTH_ACCOUNT_LINKING_DISABLED: {
    conduitCode: 'OAUTH_ACCOUNT_LINKING_DISABLED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'User with this email already exists',
    description:
      'An account with this email exists and OAuth account linking is disabled',
  },
  OAUTH_ACCOUNT_ALREADY_LINKED: {
    conduitCode: 'OAUTH_ACCOUNT_ALREADY_LINKED',
    grpcCode: status.ALREADY_EXISTS,
    message: 'This provider account is already linked to another account',
    description: 'The provider account is already connected to a different user',
  },
  OAUTH_DISCOVERY_REDIRECT_MISSING: {
    conduitCode: 'OAUTH_DISCOVERY_REDIRECT_MISSING',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'No redirect URI for the discovery',
    description: 'Discovery requires a redirect URI',
  },
  OAUTH_PROVIDER_REQUEST_FAILED: {
    conduitCode: 'OAUTH_PROVIDER_REQUEST_FAILED',
    grpcCode: status.INTERNAL,
    message: 'The OAuth provider request failed',
    description: 'A request to the identity provider failed; try again later',
  },
  // was INTERNAL
  OAUTH_NATIVE_NOT_SUPPORTED: {
    conduitCode: 'OAUTH_NATIVE_NOT_SUPPORTED',
    grpcCode: status.UNIMPLEMENTED,
    message: 'Not supported for current provider',
    description: 'This provider does not support native sign-in',
  },
  APPLE_TOKEN_INVALID: {
    conduitCode: 'APPLE_TOKEN_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid token',
    description: 'The Apple identity token is invalid',
  },
  APPLE_KEYS_UNAVAILABLE: {
    conduitCode: 'APPLE_KEYS_UNAVAILABLE',
    grpcCode: status.UNAVAILABLE,
    message: 'Unable to verify identity token',
    description: 'Apple signing keys could not be fetched; retry shortly',
  },
  APPLE_CLIENT_NOT_FOUND: {
    conduitCode: 'APPLE_CLIENT_NOT_FOUND',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Unknown Apple OAuth client id',
    description: 'No Apple OAuth client is configured with this id',
  },
  APPLE_CLIENT_CONFIG_INVALID: {
    conduitCode: 'APPLE_CLIENT_CONFIG_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid Apple OAuth client configuration',
    description:
      'The Apple OAuth client configuration is invalid (the message states why)',
  },

  // Captcha

  CAPTCHA_DISABLED: {
    conduitCode: 'CAPTCHA_DISABLED',
    grpcCode: status.INTERNAL,
    message: 'Captcha is disabled.',
    description:
      'Captcha was required for a route while it is disabled in the configuration',
  },
  // was INTERNAL
  CAPTCHA_TOKEN_MISSING: {
    conduitCode: 'CAPTCHA_TOKEN_MISSING',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Captcha token is missing.',
    description: 'The request must include a captcha token',
  },
  CAPTCHA_VERIFICATION_FAILED: {
    conduitCode: 'CAPTCHA_VERIFICATION_FAILED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Can not verify captcha.',
    description: 'The captcha token could not be verified',
  },

  // Refresh tokens

  REFRESH_TOKEN_INVALID: {
    conduitCode: 'REFRESH_TOKEN_INVALID',
    grpcCode: status.UNAUTHENTICATED,
    message: 'Refresh token is invalid or expired',
    description: 'The refresh token is unknown or expired; sign in again',
  },
  REFRESH_TOKEN_NOT_EXTENDABLE: {
    conduitCode: 'REFRESH_TOKEN_NOT_EXTENDABLE',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Refresh token is not extendable',
    description: 'This refresh token cannot be extended',
  },
  SIGNING_KEYS_UNAVAILABLE: {
    conduitCode: 'SIGNING_KEYS_UNAVAILABLE',
    grpcCode: status.UNAVAILABLE,
    message: 'Access token signing keys are not available',
    description: 'Access token signing keys are not ready; retry shortly',
  },

  // Signing keys

  SIGNING_KEYS_NOT_APPLICABLE: {
    conduitCode: 'SIGNING_KEYS_NOT_APPLICABLE',
    grpcCode: status.FAILED_PRECONDITION,
    message: "Signing keys are only used when accessTokens.mode is 'jwt'",
    description: 'Signing keys exist only when access tokens use jwt mode',
  },
  PREVIOUS_SIGNING_KEY_ACTIVE: {
    conduitCode: 'PREVIOUS_SIGNING_KEY_ACTIVE',
    grpcCode: status.FAILED_PRECONDITION,
    message:
      'The previous signing key is still active; wait for it to retire or pass force: true',
    description: 'Rotating again requires the previous key to retire, or force',
  },

  // Teams

  // some client handlers used INVALID_ARGUMENT
  TEAM_NOT_FOUND: {
    conduitCode: 'TEAM_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'Team does not exist',
    description: 'No team matches the given id',
  },
  PARENT_TEAM_NOT_FOUND: {
    conduitCode: 'PARENT_TEAM_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'New parent team not found',
    description: 'The requested parent team does not exist',
  },
  TEAM_ID_INVALID: {
    conduitCode: 'TEAM_ID_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'teamId must be a valid Team ID',
    description: 'The given teamId is not a valid team id',
  },
  TEAM_EXISTS: {
    conduitCode: 'TEAM_EXISTS',
    grpcCode: status.ALREADY_EXISTS,
    message: 'Team already exists',
    description: 'A team with this name already exists under the same parent',
  },
  DEFAULT_TEAM_EXISTS: {
    conduitCode: 'DEFAULT_TEAM_EXISTS',
    grpcCode: status.ALREADY_EXISTS,
    message: 'There already is a default team',
    description: 'Only one default team can exist',
  },
  DEFAULT_TEAM_NOT_DELETABLE: {
    conduitCode: 'DEFAULT_TEAM_NOT_DELETABLE',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Default team cannot be deleted',
    description: 'The default team cannot be deleted',
  },
  REALM_TEAM_NOT_DELETABLE: {
    conduitCode: 'REALM_TEAM_NOT_DELETABLE',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'This team is a realm. Demote the realm before deleting the team.',
    description: 'Demote the realm before deleting its team',
  },
  DEFAULT_TEAM_REALM_CONFLICT: {
    conduitCode: 'DEFAULT_TEAM_REALM_CONFLICT',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'A realm cannot be the default team',
    description: 'A team cannot be both a realm and the default team',
  },
  TEAM_ALREADY_REALM: {
    conduitCode: 'TEAM_ALREADY_REALM',
    grpcCode: status.ALREADY_EXISTS,
    message: 'Team is already a realm',
    description: 'The team is already promoted to a realm',
  },
  TEAM_PERMISSION_DENIED: {
    conduitCode: 'TEAM_PERMISSION_DENIED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'You do not have permission to perform this action on this team',
    description: 'The user lacks the permission required for this team operation',
  },
  TEAM_MEMBER_REMOVAL_DENIED: {
    conduitCode: 'TEAM_MEMBER_REMOVAL_DENIED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'One or more members were not deleted',
    description: 'Some members, such as owners, could not be removed by this user',
  },
  // was INVALID_ARGUMENT
  TEAM_ADD_WITHOUT_INVITE_DENIED: {
    conduitCode: 'TEAM_ADD_WITHOUT_INVITE_DENIED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Adding users to this team without an invitation is not allowed',
    description: 'Members can only join this team through an invitation',
  },
  TEAM_SELF_REMOVAL: {
    conduitCode: 'TEAM_SELF_REMOVAL',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Cannot remove self from team',
    description: 'Users cannot remove themselves from a team with this operation',
  },
  TEAM_SELF_ROLE_CHANGE: {
    conduitCode: 'TEAM_SELF_ROLE_CHANGE',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Cannot change self role',
    description: 'Users cannot change their own role in a team',
  },
  TEAM_OPERATION_FAILED: {
    conduitCode: 'TEAM_OPERATION_FAILED',
    grpcCode: status.INTERNAL,
    message: 'Team operation failed',
    description: 'The team operation could not be completed; try again later',
  },

  // Team invitations

  TEAM_INVITES_DISABLED: {
    conduitCode: 'TEAM_INVITES_DISABLED',
    grpcCode: status.PERMISSION_DENIED,
    message: 'Team invites are disabled',
    description: 'Team invitations are turned off in the configuration',
  },
  // addUserToTeam used INVALID_ARGUMENT
  TEAM_INVITE_NOT_FOUND: {
    conduitCode: 'TEAM_INVITE_NOT_FOUND',
    grpcCode: status.NOT_FOUND,
    message: 'Invitation not found',
    description: 'The invitation token is unknown or expired',
  },
  TEAM_INVITE_EMAIL_MISMATCH: {
    conduitCode: 'TEAM_INVITE_EMAIL_MISMATCH',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'The invitation was issued for a different email address',
    description: 'The invitation belongs to another email address',
  },

  // Realms

  REALM_SLUG_INVALID: {
    conduitCode: 'REALM_SLUG_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid realm slug',
    description:
      'The realm slug is missing, reserved or malformed (the message states why)',
  },
  REALM_SLUG_CHANGE_REQUIRES_FORCE: {
    conduitCode: 'REALM_SLUG_CHANGE_REQUIRES_FORCE',
    grpcCode: status.INVALID_ARGUMENT,
    message:
      'Changing the realm slug breaks clients that use it; send force: true to confirm',
    description: 'Confirm the slug change with force: true',
  },
  REALM_ID_INVALID: {
    conduitCode: 'REALM_ID_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'realm must be a realm team id',
    description: 'The given id is not the id of a realm team',
  },
  REALM_SETTINGS_INVALID: {
    conduitCode: 'REALM_SETTINGS_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid realm settings',
    description: 'The realm settings failed validation (the message states which field)',
  },
  REALM_MEMBERSHIP_TYPE_INVALID: {
    conduitCode: 'REALM_MEMBERSHIP_TYPE_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: "type must be 'home' or 'guest'",
    description: 'The membership type must be home or guest',
  },
  HOME_USER_CANNOT_BE_GUEST: {
    conduitCode: 'HOME_USER_CANNOT_BE_GUEST',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'The user is a home user of this realm and cannot be its guest',
    description: 'A home user of a realm cannot also be its guest',
  },
  HOME_REALM_MOVE_REQUIRES_FORCE: {
    conduitCode: 'HOME_REALM_MOVE_REQUIRES_FORCE',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'The user already has a different home realm. Set force to move them',
    description: 'Confirm moving the user to a new home realm with force',
  },
  DISCOVERY_REQUEST_INVALID: {
    conduitCode: 'DISCOVERY_REQUEST_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid discovery request',
    description: 'Discovery is disabled or was combined with a realm or invitation token',
  },
  REALM_DISCOVERY_DISABLED: {
    conduitCode: 'REALM_DISCOVERY_DISABLED',
    grpcCode: status.NOT_FOUND,
    message: 'Not found',
    description: 'Realm discovery by email is not enabled',
  },
  REALMS_DISABLE_BLOCKED: {
    conduitCode: 'REALMS_DISABLE_BLOCKED',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Realms cannot be disabled while enabled realms exist',
    description: 'Disable or delete the enabled realms first',
  },
  IDENTITY_MODE_REVERT_BLOCKED: {
    conduitCode: 'IDENTITY_MODE_REVERT_BLOCKED',
    grpcCode: status.FAILED_PRECONDITION,
    message: 'Identity mode cannot be reverted while identifier collisions exist',
    description: 'Resolve the colliding identifiers before reverting the identity mode',
  },
  REALM_OPERATION_FAILED: {
    conduitCode: 'REALM_OPERATION_FAILED',
    grpcCode: status.INTERNAL,
    message: 'Realm operation failed',
    description: 'The realm operation could not be completed; try again later',
  },

  // Configuration and dependencies

  AUTH_CONFIG_INVALID: {
    conduitCode: 'AUTH_CONFIG_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid authentication configuration',
    description:
      'The authentication configuration failed validation (the message states why)',
  },
  AUTH_CONFIG_PERSISTENCE_UNAVAILABLE: {
    conduitCode: 'AUTH_CONFIG_PERSISTENCE_UNAVAILABLE',
    grpcCode: status.UNAVAILABLE,
    message: 'Config persistence is not available',
    description: 'The configuration cannot be read or saved right now; retry shortly',
  },
  AUTHORIZATION_UNAVAILABLE: {
    conduitCode: 'AUTHORIZATION_UNAVAILABLE',
    grpcCode: status.UNAVAILABLE,
    message: 'The authorization module is not available',
    description:
      'Team features need the authorization module, which is not available; retry shortly',
  },

  // Generic

  REQUEST_INVALID: {
    conduitCode: 'REQUEST_INVALID',
    grpcCode: status.INVALID_ARGUMENT,
    message: 'Invalid request',
    description: 'The request is invalid (the message states why)',
  },
  AUTH_OPERATION_FAILED: {
    conduitCode: 'AUTH_OPERATION_FAILED',
    grpcCode: status.INTERNAL,
    message: 'Authentication operation failed',
    description: 'The operation could not be completed; try again later',
  },
} as const satisfies Record<string, ModuleErrorDefinition>;
