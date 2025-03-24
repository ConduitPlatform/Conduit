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
      ConduitGrpcSdk.Logger.log('PushOwl Provider initialized successfully.');
    } catch (e) {
      this._initialized = false;
      ConduitGrpcSdk.Logger.error(
        `Failed to initialize PushOwl: ${(e as Error).message}`,
      );
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

    // PushOwl is only a Web push notifications provider, it cannot be silent
    if (params.isSilent) {
      ConduitGrpcSdk.Logger.warn(
        'Silent notifications are not supported for web push notifications',
      );
      return;
    }

    const payload = {
      notification: {
        title: title,
        description: body,
        data: data || {},
      },
      customer_ids: [token],
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
