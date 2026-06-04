# Communications Module Migration Guide

This guide helps you migrate from the separate Email, Push Notifications, and SMS modules to the unified Communications module.

## ⚠️ Hard Migration Approach

**Email, Push Notifications, and SMS modules are now DEPRECATED and will be removed in future releases.**

The Communications module provides a **hard migration** path:
- ✅ **Zero code changes needed** - existing code continues to work
- ✅ **Automatic routing** - grpc-sdk routes legacy calls to Communications
- ✅ **No breaking changes** - all existing APIs preserved
- ✅ **New features available** - orchestration, multi-channel, fallbacks

## Migration Steps

### 1. Deploy Communications Module

**Replace your module deployments:**
```typescript
// OLD: Deploy separate modules
// modules/email
// modules/push-notifications  
// modules/sms

// NEW: Deploy unified module
import Communications from './modules/communications';
app.addModule(new Communications());
```

**No code changes needed** - the grpc-sdk automatically routes:
- `grpcSdk.email` → Communications module
- `grpcSdk.pushNotifications` → Communications module  
- `grpcSdk.sms` → Communications module

### 2. Update Configuration

**Before:**
```yaml
# Separate configurations
email:
  active: true
  transport: 'sendgrid'
  transportSettings:
    sendgrid:
      apiKey: 'your-key'

pushNotifications:
  active: true
  providerName: 'firebase'
  firebase:
    projectId: 'your-project'

sms:
  active: true
  providerName: 'twilio'
  twilio:
    accountSID: 'your-sid'
```

**After:**
```yaml
# Unified configuration
communications:
  active: true
  email:
    transport: 'sendgrid'
    transportSettings:
      sendgrid:
        apiKey: 'your-key'
  pushNotifications:
    providerName: 'firebase'
    firebase:
      projectId: 'your-project'
  sms:
    providerName: 'twilio'
    twilio:
      accountSID: 'your-sid'
```

### 3. Update gRPC SDK Usage

**No changes required for existing code!** All existing methods continue to work:

```typescript
// These continue to work exactly as before
await grpcSdk.email.sendEmail('Welcome', {
  email: 'user@example.com',
  variables: { name: 'John' }
});

await grpcSdk.pushNotifications.sendNotification('user123', 'Hello', 'World');

await grpcSdk.sms.sendSms('+1234567890', 'Your code is 123456');
```

### 4. Optional: Use New Unified Features

You can now use the new orchestration features alongside existing code:

```typescript
// New multi-channel messaging
await grpcSdk.communications.sendToMultipleChannels(
  ['email', 'push', 'sms'],
  'BEST_EFFORT',
  {
    recipient: 'user@example.com',
    subject: 'Important Update',
    body: 'Please check your account',
    variables: { username: 'john' }
  }
);

// New fallback chains
await grpcSdk.communications.sendWithFallback(
  [
    { channel: 'email', timeout: 5000 },
    { channel: 'sms', timeout: 3000 }
  ],
  {
    recipient: 'user@example.com',
    subject: 'Urgent: Account Update',
    body: 'Your account has been updated'
  }
);
```

## Backward Compatibility

### Legacy Endpoints Preserved

All existing gRPC endpoints remain functional:

| Original Module | Endpoint | Status |
|----------------|----------|---------|
| Email | `email.Email.SendEmail` | ✅ Preserved |
| Email | `email.Email.RegisterTemplate` | ✅ Preserved |
| Push | `pushnotifications.PushNotifications.SendNotification` | ✅ Preserved |
| Push | `pushnotifications.PushNotifications.SetNotificationToken` | ✅ Preserved |
| SMS | `sms.Sms.SendSms` | ✅ Preserved |
| SMS | `sms.Sms.SendVerificationCode` | ✅ Preserved |

### Legacy SDK Methods Preserved

All existing SDK methods continue to work:

```typescript
// Email methods
grpcSdk.email.sendEmail()
grpcSdk.email.registerTemplate()
grpcSdk.email.getEmailStatus()

// Push notification methods
grpcSdk.pushNotifications.sendNotification()
grpcSdk.pushNotifications.setNotificationToken()
grpcSdk.pushNotifications.getNotificationTokens()

// SMS methods
grpcSdk.sms.sendSms()
grpcSdk.sms.sendVerificationCode()
grpcSdk.sms.verify()
```

## New Features

### 1. Multi-Channel Broadcasting

Send the same message to multiple channels:

```typescript
const result = await grpcSdk.communications.sendToMultipleChannels(
  ['email', 'push', 'sms'],
  'BEST_EFFORT',
  {
    recipient: 'user@example.com',
    subject: 'Account Update',
    body: 'Your account has been updated',
    variables: { accountId: '12345' }
  }
);

console.log(`Sent to ${result.successCount} channels successfully`);
console.log(`Failed on ${result.failureCount} channels`);
```

### 2. Fallback Chains

Try channels in order until one succeeds:

```typescript
const result = await grpcSdk.communications.sendWithFallback(
  [
    { channel: 'email', timeout: 5000 },
    { channel: 'push', timeout: 3000 },
    { channel: 'sms', timeout: 2000 }
  ],
  {
    recipient: 'user@example.com',
    subject: 'Urgent: Security Alert',
    body: 'Suspicious activity detected'
  }
);

console.log(`Successfully sent via ${result.successfulChannel}`);
console.log(`Attempted ${result.attempts.length} channels`);
```

### 3. Unified Status Tracking

Check message status across all channels:

```typescript
// Check email status
const emailStatus = await grpcSdk.communications.getMessageStatus('email', messageId);

// Check push status
const pushStatus = await grpcSdk.communications.getMessageStatus('push', messageId);

// Check SMS status
const smsStatus = await grpcSdk.communications.getMessageStatus('sms', messageId);
```

## Configuration Migration

### Email Configuration
```yaml
# Before
email:
  active: true
  transport: 'sendgrid'
  sendingDomain: 'example.com'
  transportSettings:
    sendgrid:
      apiKey: 'your-key'

# After
communications:
  active: true
  email:
    transport: 'sendgrid'
    sendingDomain: 'example.com'
    transportSettings:
      sendgrid:
        apiKey: 'your-key'
```

### Push Notifications Configuration
```yaml
# Before
pushNotifications:
  active: true
  providerName: 'firebase'
  firebase:
    projectId: 'your-project'

# After
communications:
  active: true
  pushNotifications:
    providerName: 'firebase'
    firebase:
      projectId: 'your-project'
```

### SMS Configuration
```yaml
# Before
sms:
  active: true
  providerName: 'twilio'
  twilio:
    accountSID: 'your-sid'

# After
communications:
  active: true
  sms:
    providerName: 'twilio'
    twilio:
      accountSID: 'your-sid'
```

## Monitoring and Metrics

### New Metrics
- `communications_sent_total`: Total communications sent
- `communications_success_total`: Successful deliveries
- `communications_failure_total`: Failed deliveries
- `fallback_chain_used_total`: Fallback chain usage

### Legacy Metrics Preserved
- `emails_sent_total`: Email messages sent
- `push_notifications_sent_total`: Push notifications sent
- `sms_sent_total`: SMS messages sent

## Testing

### Test Legacy Endpoints
```typescript
// Test that existing endpoints still work
describe('Legacy Compatibility', () => {
  it('should send email via legacy endpoint', async () => {
    const result = await grpcSdk.email.sendEmail('Welcome', {
      email: 'test@example.com',
      variables: { name: 'Test' }
    });
    expect(result).toBeDefined();
  });

  it('should send push notification via legacy endpoint', async () => {
    const result = await grpcSdk.pushNotifications.sendNotification(
      'user123',
      'Test',
      'Test message'
    );
    expect(result).toBeDefined();
  });

  it('should send SMS via legacy endpoint', async () => {
    const result = await grpcSdk.sms.sendSms('+1234567890', 'Test message');
    expect(result).toBeDefined();
  });
});
```

### Test New Features
```typescript
// Test new orchestration features
describe('New Features', () => {
  it('should send to multiple channels', async () => {
    const result = await grpcSdk.communications.sendToMultipleChannels(
      ['email', 'push'],
      'BEST_EFFORT',
      {
        recipient: 'test@example.com',
        subject: 'Test',
        body: 'Test message'
      }
    );
    expect(result.results.length).toBe(2);
  });

  it('should use fallback chain', async () => {
    const result = await grpcSdk.communications.sendWithFallback(
      [
        { channel: 'email', timeout: 5000 },
        { channel: 'sms', timeout: 3000 }
      ],
      {
        recipient: 'test@example.com',
        subject: 'Test',
        body: 'Test message'
      }
    );
    expect(result.successfulChannel).toBeDefined();
  });
});
```

## Rollback Plan

If you need to rollback to separate modules:

1. **Revert module registration** to use separate modules
2. **Revert configuration** to separate configs
3. **No code changes needed** - all existing integrations continue to work

The Communications module is designed to be a drop-in replacement with zero breaking changes.

## Support

For questions or issues during migration:
1. Check the [Communications Module README](./README.md)
2. Review the [API documentation](./API.md)
3. Contact the development team

## Benefits After Migration

1. **Unified Configuration**: Single config file for all communication channels
2. **Orchestration**: Multi-channel messaging and fallback chains
3. **Better Monitoring**: Centralized metrics and status tracking
4. **Simplified Deployment**: Single module instead of three
5. **Future Features**: Access to new unified capabilities
6. **Backward Compatibility**: All existing code continues to work
