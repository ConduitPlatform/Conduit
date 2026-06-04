# Communications Module

The Communications module is a **unified messaging system** that replaces the separate Email, Push Notifications, and SMS modules. It combines all messaging capabilities into a single, orchestrated service.

## ⚠️ Hard Migration Notice

**Email, Push Notifications, and SMS modules are now DEPRECATED.**

- All functionality has been moved to the Communications module
- Legacy modules are marked for removal in future releases
- **Zero code changes needed** - grpc-sdk automatically routes to Communications
- See [Migration Guide](MIGRATION_GUIDE.md) for details

## Features

### Multi-Channel Messaging
- Send messages via email, push notifications, and SMS
- Broadcast to multiple channels simultaneously
- Fallback chains with ordered priority
- Best-effort and all-or-nothing delivery strategies

### Backward Compatibility
- All existing Email, Push Notifications, and SMS endpoints remain functional
- Legacy gRPC services are preserved
- Existing integrations continue to work without changes
- **No breaking changes** - all existing code continues to work

### Template System
- **Email templates**: Full Handlebars support with variables
- **Push/SMS templates**: Simple string interpolation with `{{variable}}` syntax
- **Unified templates**: Multi-channel templates for coordinated messaging

### Orchestration
- **Multi-channel broadcasts**: Send to all channels at once
- **Fallback chains**: Try email, fallback to SMS if it fails
- **Partial success tracking**: Report which channels succeeded/failed
- **Timeout management**: Configurable timeouts for each channel

## API Examples

### Send to Single Channel
```typescript
// Send email
await communications.sendMessage('email', {
  recipient: 'user@example.com',
  subject: 'Welcome!',
  body: 'Welcome to our service',
  variables: { name: 'John' }
});

// Send push notification
await communications.sendMessage('push', {
  recipient: 'user123',
  title: 'New Message',
  body: 'You have a new message',
  data: { type: 'message' }
});

// Send SMS
await communications.sendMessage('sms', {
  recipient: '+1234567890',
  body: 'Your verification code is {{code}}',
  variables: { code: '123456' }
});
```

### Send to Multiple Channels
```typescript
// Broadcast to all channels
await communications.sendToMultipleChannels(
  ['email', 'push', 'sms'],
  'BEST_EFFORT',
  {
    recipient: 'user@example.com',
    subject: 'Important Update',
    body: 'Please check your account',
    variables: { username: 'john' }
  }
);
```

### Fallback Chain
```typescript
// Try email first, fallback to SMS if it fails
await communications.sendWithFallback(
  [
    { channel: 'email', timeout: 5000 },
    { channel: 'sms', timeout: 3000 }
  ],
  {
    recipient: 'user@example.com',
    subject: 'Urgent: Account Update',
    body: 'Your account has been updated',
    variables: { accountId: '12345' }
  }
);
```

## Configuration

The module combines configuration from all three original modules:

```yaml
communications:
  active: true
  email:
    transport: 'sendgrid'
    sendingDomain: 'example.com'
    transportSettings:
      sendgrid:
        apiKey: 'your-api-key'
  pushNotifications:
    providerName: 'firebase'
    firebase:
      projectId: 'your-project'
      privateKey: 'your-private-key'
      clientEmail: 'your-client-email'
  sms:
    providerName: 'twilio'
    twilio:
      phoneNumber: '+1234567890'
      accountSID: 'your-account-sid'
      authToken: 'your-auth-token'
  orchestration:
    retryAttempts: 3
    retryDelay: 1000
    timeout: 30000
    fallbackTimeout: 5000
```

## Migration Guide

### For Existing Modules
No changes required! All existing integrations continue to work:

```typescript
// These still work exactly as before
await grpcSdk.email.sendEmail('Welcome', { email: 'user@example.com', variables: { name: 'John' } });
await grpcSdk.pushNotifications.sendNotification('user123', 'Hello', 'World');
await grpcSdk.sms.sendSms('+1234567890', 'Your code is 123456');
```

### For New Integrations
Use the unified Communications client for new features:

```typescript
// New unified approach
await grpcSdk.communications.sendMessage('email', { ... });
await grpcSdk.communications.sendToMultipleChannels(['email', 'push'], 'BEST_EFFORT', { ... });
await grpcSdk.communications.sendWithFallback([...], { ... });
```

## Architecture

```
Communications Module
├── Services
│   ├── EmailService (IChannel)
│   ├── PushService (IChannel)
│   ├── SmsService (IChannel)
│   └── OrchestratorService
├── Providers
│   ├── email/ (all email providers)
│   ├── push/ (all push providers)
│   └── sms/ (all SMS providers)
├── Models
│   ├── EmailTemplate, EmailRecord
│   ├── Notification, NotificationToken
│   ├── SmsRecord
│   └── CommunicationTemplate (unified)
└── Interfaces
    ├── IChannel (unified channel interface)
    ├── IChannelProvider
    └── ISendParams
```

## Benefits

1. **Unified API**: Single interface for all communication channels
2. **Orchestration**: Coordinate messaging across multiple channels
3. **Reliability**: Fallback chains ensure message delivery
4. **Backward Compatibility**: No breaking changes to existing code
5. **Scalability**: Centralized configuration and monitoring
6. **Flexibility**: Mix and match channels based on user preferences

## Monitoring

The module provides comprehensive metrics:
- `communications_sent_total`: Total communications sent
- `communications_success_total`: Successful deliveries
- `communications_failure_total`: Failed deliveries
- `fallback_chain_used_total`: Fallback chain usage
- Per-channel metrics (emails_sent_total, push_notifications_sent_total, sms_sent_total)
