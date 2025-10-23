import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import Communications from '../Communications.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

// Mock the grpcSdk
const mockGrpcSdk = {
  waitForExistence: jest.fn().mockResolvedValue(undefined),
  database: {
    createSchemaFromAdapter: jest.fn().mockResolvedValue(undefined),
    migrate: jest.fn().mockResolvedValue(undefined),
  },
  isAvailable: jest.fn().mockReturnValue(true),
  config: {
    get: jest.fn().mockResolvedValue({
      active: true,
      email: { transport: 'smtp' },
      pushNotifications: { providerName: 'basic' },
      sms: { providerName: 'twilio' },
    }),
  },
  Logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
  Metrics: {
    set: jest.fn(),
    increment: jest.fn(),
  },
} as unknown as ConduitGrpcSdk;

describe('Communications Module', () => {
  let communications: Communications;

  beforeEach(() => {
    communications = new Communications();
    // Mock the grpcSdk
    (communications as any).grpcSdk = mockGrpcSdk;
  });

  describe('Module Initialization', () => {
    it('should initialize with correct service configuration', () => {
      expect(communications.service.protoDescription).toBe(
        'communications.Communications',
      );
      expect(communications.service.functions).toHaveProperty('sendEmail');
      expect(communications.service.functions).toHaveProperty('sendNotification');
      expect(communications.service.functions).toHaveProperty('sendSms');
      expect(communications.service.functions).toHaveProperty('sendMessage');
      expect(communications.service.functions).toHaveProperty('sendToMultipleChannels');
      expect(communications.service.functions).toHaveProperty('sendWithFallback');
    });

    it('should have all legacy endpoints', () => {
      const functions = communications.service.functions;

      // Legacy Email endpoints
      expect(functions).toHaveProperty('registerTemplate');
      expect(functions).toHaveProperty('updateTemplate');
      expect(functions).toHaveProperty('sendEmail');
      expect(functions).toHaveProperty('resendEmail');
      expect(functions).toHaveProperty('getEmailStatus');

      // Legacy Push endpoints
      expect(functions).toHaveProperty('setNotificationToken');
      expect(functions).toHaveProperty('getNotificationTokens');
      expect(functions).toHaveProperty('sendNotification');
      expect(functions).toHaveProperty('sendNotificationToManyDevices');
      expect(functions).toHaveProperty('sendManyNotifications');

      // Legacy SMS endpoints
      expect(functions).toHaveProperty('sendSms');
      expect(functions).toHaveProperty('sendVerificationCode');
      expect(functions).toHaveProperty('verify');
    });

    it('should have new unified endpoints', () => {
      const functions = communications.service.functions;

      // New unified endpoints
      expect(functions).toHaveProperty('sendMessage');
      expect(functions).toHaveProperty('sendToMultipleChannels');
      expect(functions).toHaveProperty('sendWithFallback');
      expect(functions).toHaveProperty('registerCommunicationTemplate');
      expect(functions).toHaveProperty('getMessageStatus');
    });
  });

  describe('Configuration', () => {
    it('should validate configuration correctly', async () => {
      const validConfig = {
        active: true,
        email: { transport: 'smtp' },
        pushNotifications: { providerName: 'basic' },
        sms: { providerName: 'twilio' },
      };

      const result = await communications.preConfig(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        active: true,
        // Missing required fields
      };

      await expect(communications.preConfig(invalidConfig as any)).rejects.toThrow(
        'Invalid configuration given',
      );
    });
  });

  describe('Legacy Email Endpoints', () => {
    it('should handle registerTemplate request', async () => {
      const mockCallback = jest.fn();
      const mockCall = {
        request: {
          name: 'test-template',
          subject: 'Test Subject',
          body: 'Test Body',
          variables: ['name'],
          sender: 'test@example.com',
        },
      };

      // Mock the email service
      (communications as any).emailService = {
        registerTemplate: jest.fn().mockResolvedValue({ _id: 'template-id' }),
      };

      await communications.registerTemplate(mockCall as any, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, {
        template: JSON.stringify({ _id: 'template-id' }),
      });
    });

    it('should handle sendEmail request', async () => {
      const mockCallback = jest.fn();
      const mockCall = {
        request: {
          templateName: 'test-template',
          params: {
            email: 'test@example.com',
            subject: 'Test Subject',
            body: 'Test Body',
            variables: JSON.stringify({ name: 'John' }),
            sender: 'noreply@example.com',
            cc: [],
            replyTo: '',
            attachments: [],
          },
        },
      };

      // Mock the email service
      (communications as any).emailService = {
        sendEmail: jest.fn().mockResolvedValue({ messageId: 'msg-123' }),
      };

      await communications.sendEmail(mockCall as any, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, {
        sentMessageInfo: { messageId: 'msg-123' },
      });
    });
  });

  describe('Legacy Push Endpoints', () => {
    it('should handle sendNotification request', async () => {
      const mockCallback = jest.fn();
      const mockCall = {
        request: {
          sendTo: 'user123',
          title: 'Test Title',
          body: 'Test Body',
          data: JSON.stringify({ type: 'test' }),
          platform: 'ios',
          doNotStore: false,
          isSilent: false,
        },
      };

      // Mock the push service
      (communications as any).pushService = {
        sendNotification: jest.fn().mockResolvedValue(undefined),
      };

      await communications.sendNotification(mockCall as any, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, { message: 'Ok' });
    });
  });

  describe('Legacy SMS Endpoints', () => {
    it('should handle sendSms request', async () => {
      const mockCallback = jest.fn();
      const mockCall = {
        request: {
          to: '+1234567890',
          message: 'Test SMS',
        },
      };

      // Mock the SMS service
      (communications as any).smsService = {
        sendSms: jest.fn().mockResolvedValue({ messageId: 'sms-123' }),
      };

      await communications.sendSms(mockCall as any, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, { message: 'SMS sent' });
    });
  });

  describe('New Unified Endpoints', () => {
    it('should handle sendMessage request', async () => {
      const mockCallback = jest.fn();
      const mockCall = {
        request: {
          channel: 'email',
          templateName: '',
          params: {
            recipient: 'test@example.com',
            subject: 'Test Subject',
            body: 'Test Body',
            variables: JSON.stringify({ name: 'John' }),
            sender: 'noreply@example.com',
            cc: [],
            replyTo: '',
            attachments: [],
            data: JSON.stringify({}),
            platform: '',
            doNotStore: false,
            isSilent: false,
          },
        },
      };

      // Mock the orchestrator service
      (communications as any).orchestratorService = {
        sendToChannel: jest.fn().mockResolvedValue({
          success: true,
          messageId: 'msg-123',
          channel: 'email',
        }),
      };

      await communications.sendMessage(mockCall as any, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, {
        messageId: 'msg-123',
        sentMessageInfo: JSON.stringify({
          success: true,
          messageId: 'msg-123',
          channel: 'email',
        }),
      });
    });

    it('should handle sendToMultipleChannels request', async () => {
      const mockCallback = jest.fn();
      const mockCall = {
        request: {
          channels: ['email', 'push'],
          strategy: 'BEST_EFFORT',
          templateName: '',
          params: {
            recipient: 'test@example.com',
            subject: 'Test Subject',
            body: 'Test Body',
            variables: JSON.stringify({ name: 'John' }),
            sender: 'noreply@example.com',
            cc: [],
            replyTo: '',
            attachments: [],
            data: JSON.stringify({}),
            platform: '',
            doNotStore: false,
            isSilent: false,
          },
        },
      };

      // Mock the orchestrator service
      (communications as any).orchestratorService = {
        sendToMultipleChannels: jest.fn().mockResolvedValue({
          results: [
            { success: true, messageId: 'msg-1', channel: 'email' },
            { success: true, messageId: 'msg-2', channel: 'push' },
          ],
          successCount: 2,
          failureCount: 0,
        }),
      };

      await communications.sendToMultipleChannels(mockCall as any, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, {
        results: [
          { success: true, messageId: 'msg-1', channel: 'email' },
          { success: true, messageId: 'msg-2', channel: 'push' },
        ],
      });
    });

    it('should handle sendWithFallback request', async () => {
      const mockCallback = jest.fn();
      const mockCall = {
        request: {
          fallbackChain: [
            { channel: 'email', timeout: 5000 },
            { channel: 'sms', timeout: 3000 },
          ],
          templateName: '',
          params: {
            recipient: 'test@example.com',
            subject: 'Test Subject',
            body: 'Test Body',
            variables: JSON.stringify({ name: 'John' }),
            sender: 'noreply@example.com',
            cc: [],
            replyTo: '',
            attachments: [],
            data: JSON.stringify({}),
            platform: '',
            doNotStore: false,
            isSilent: false,
          },
        },
      };

      // Mock the orchestrator service
      (communications as any).orchestratorService = {
        sendWithFallback: jest.fn().mockResolvedValue({
          successfulChannel: 'email',
          messageId: 'msg-123',
          attempts: [{ success: true, messageId: 'msg-123', channel: 'email' }],
        }),
      };

      await communications.sendWithFallback(mockCall as any, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, {
        successfulChannel: 'email',
        messageId: 'msg-123',
        attempts: [{ success: true, messageId: 'msg-123', channel: 'email' }],
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const mockCallback = jest.fn();
      const mockCall = {
        request: {
          templateName: 'test-template',
          params: {
            email: 'test@example.com',
            subject: 'Test Subject',
            body: 'Test Body',
            variables: JSON.stringify({ name: 'John' }),
            sender: 'noreply@example.com',
            cc: [],
            replyTo: '',
            attachments: [],
          },
        },
      };

      // Mock the email service to throw an error
      (communications as any).emailService = {
        sendEmail: jest.fn().mockRejectedValue(new Error('Service unavailable')),
      };

      await communications.sendEmail(mockCall as any, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith({
        code: 13, // INTERNAL status
        message: 'Service unavailable',
      });
    });
  });
});
