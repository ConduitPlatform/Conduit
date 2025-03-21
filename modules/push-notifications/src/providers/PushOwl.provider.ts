import axios from 'axios';
import { BaseNotificationProvider } from './base.provider.js';
import { IPushOwlSettings } from '../interfaces/IPushOwlSettings.js';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { NotificationToken } from '../models/index.js';

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
    } catch {
      this._initialized = false;
    }
  }

  async sendMessage(
    token: string,
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void> {
    if (!this._initialized) {
      throw new Error('PushOwl Provider is not initialized.');
    }

    const { title, body, data } = params;

    const payload = {
      notification: {
        title: title,
        description: body,
        redirect_url: data?.trackingUrl || '',
        icon: data?.iconUrl || '',
        image: data?.imageUrl || '',
        actions: data?.actions || [],
      },
      subscriber_tokens: data?.subscriber_tokens || [],
      customer_ids: token ? [token] : [],
      emails: data?.emails || [],
    };

    return axios
      .post(this.endpoint!, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${this.apiKey}`,
        },
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error('Failed to send PushOwl notification:', e);
        return NotificationToken.getInstance().deleteOne({ token });
      });
  }
}
