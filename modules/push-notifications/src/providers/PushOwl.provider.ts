import axios from 'axios';
import { BaseNotificationProvider } from './base.provider.js';
import { IPushOwlSettings } from '../interfaces/IPushOwlSettings.js';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

export class PushOwlProvider extends BaseNotificationProvider<IPushOwlSettings> {
  private apiKey?: string;
  private endpoint?: string;

  constructor(settings: IPushOwlSettings) {
    super();
    this._initialized = false;
    this.isBaseProvider = false;
    this.updateProvider(settings);
  }

  updateProvider(settings: IPushOwlSettings) {
    try {
      this.apiKey = settings.apiKey;
      this.endpoint = settings.endpoint;

      if (!this.apiKey || !this.endpoint) {
        throw new Error('Missing required PushOwl API configuration.');
      }

      this._initialized = true;
      ConduitGrpcSdk.Logger.log('PushOwl Provider initialized successfully.');
    } catch (e) {
      this._initialized = false;
      ConduitGrpcSdk.Logger.error('Failed to initialize PushOwl Provider:');
    }
  }

  async sendMessage(
    token: string,
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void> {
    if (!this._initialized) {
      throw new Error('PushOwl Provider is not initialized.');
    }

    console.log('Sending notification via PushOwl...');

    try {
      const { title, body, data } = params;

      console.log('Token:', token);
      console.log('Payload Data:', data);

      const payload = {
        notification: {
          title: title,
          description: body,
          redirect_url: data?.trackingUrl || 'https://pushowl.com',
          icon: data?.iconUrl || '',
          image: data?.imageUrl || '',
          actions: data?.actions || [],
        },
        subscriber_tokens: data?.subscriber_tokens || [],
        customer_ids: token ? [token] : [],
        emails: data?.emails || [],
      };

      console.log('Final Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(this.endpoint!, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${this.apiKey}`,
        },
      });

      console.log('PushOwl Response:', response.data);
    } catch (error: any) {
      console.error(
        'PushOwl API Error:',
        error.response ? error.response.data : error.message,
      );
    }
  }
}
