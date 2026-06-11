import { ConduitGrpcSdk, PlatformTypesEnum } from '@conduitplatform/grpc-sdk';
import { validateNotification } from './utils/index.js';
import { groupBy, isNil } from 'lodash-es';
import { NotificationToken, Notification, User } from '../../models/index.js';
import {
  IPushBatchResult,
  IPushSendAggregateResult,
  IPushSendFailure,
  IPushTokenTarget,
  ISendNotification,
  ISendNotificationToManyDevices,
} from './interfaces/index.js';

const RECIPIENT_PAGE_SIZE = 1000;
const DEFAULT_SEND_CHUNK_SIZE = 500;
const SEND_CONCURRENCY = 10;

export class BaseNotificationProvider<T> {
  _initialized: boolean = true;
  isBaseProvider: boolean = true;

  get isInitialized(): boolean {
    return this._initialized;
  }

  async registerDeviceToken(token: string, platform: PlatformTypesEnum): Promise<string> {
    return token;
  }

  sendMessage(
    token: string | string[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void | string> {
    return Promise.resolve();
  }

  async sendMessages(
    targets: IPushTokenTarget[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<IPushBatchResult> {
    const outcomes = await this.mapWithConcurrency(
      targets,
      SEND_CONCURRENCY,
      async target => {
        try {
          await this.sendMessage(target.token, {
            ...params,
            platform: params.platform ?? target.platform,
          });
          return { ok: true as const };
        } catch (error) {
          return {
            ok: false as const,
            failure: {
              token: target.token,
              platform: target.platform,
              error,
            },
          };
        }
      },
    );

    const failures: IPushSendFailure[] = [];
    let successCount = 0;
    for (const outcome of outcomes) {
      if (outcome.ok) successCount++;
      else failures.push(outcome.failure);
    }

    return {
      successCount,
      failureCount: failures.length,
      failures,
    };
  }

  protected getSendChunkSize(): number {
    return DEFAULT_SEND_CHUNK_SIZE;
  }

  protected chunkItems<V>(items: V[], chunkSize: number = RECIPIENT_PAGE_SIZE): V[][] {
    if (items.length === 0) return [];
    const chunks: V[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  protected toTokenTargets(tokens: NotificationToken[]): IPushTokenTarget[] {
    return tokens.map(token => ({
      token: token.token,
      platform: token.platform,
    }));
  }

  protected groupTargetsByPlatform(
    targets: IPushTokenTarget[],
    platform?: string,
  ): IPushTokenTarget[][] {
    const groups = new Map<string, IPushTokenTarget[]>();
    for (const target of targets) {
      const effectivePlatform = platform ?? target.platform;
      const bucket = groups.get(effectivePlatform) ?? [];
      bucket.push(target);
      groups.set(effectivePlatform, bucket);
    }
    return [...groups.values()];
  }

  protected chunkTargets(
    targets: IPushTokenTarget[],
    chunkSize: number = this.getSendChunkSize(),
  ): IPushTokenTarget[][] {
    return this.chunkItems(targets, chunkSize);
  }

  protected mergeBatchResults(results: IPushBatchResult[]): IPushBatchResult {
    return results.reduce(
      (acc, result) => ({
        successCount: acc.successCount + result.successCount,
        failureCount: acc.failureCount + result.failureCount,
        failures: acc.failures.concat(result.failures),
      }),
      { successCount: 0, failureCount: 0, failures: [] as IPushSendFailure[] },
    );
  }

  protected async mapWithConcurrency<V, R>(
    items: V[],
    concurrency: number,
    fn: (item: V, index: number) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) return [];
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const index = nextIndex++;
          results[index] = await fn(items[index], index);
        }
      }),
    );
    return results;
  }

  protected async dispatchSendMessages(
    targets: IPushTokenTarget[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<IPushBatchResult[]> {
    const results: IPushBatchResult[] = [];
    for (const platformGroup of this.groupTargetsByPlatform(targets, params.platform)) {
      for (const chunk of this.chunkTargets(platformGroup)) {
        results.push(await this.sendMessages(chunk, params));
      }
    }
    return results;
  }

  protected mergeTokensIntoCache(
    cache: Map<string, NotificationToken[]>,
    tokens: NotificationToken[],
  ): void {
    for (const token of tokens) {
      const userId = token.userId.toString();
      const bucket = cache.get(userId);
      if (bucket) bucket.push(token);
      else cache.set(userId, [token]);
    }
  }

  protected logBatchFailures(results: IPushBatchResult[]): void {
    for (const failure of results.flatMap(result => result.failures)) {
      ConduitGrpcSdk.Logger.error(
        failure.error instanceof Error
          ? failure.error
          : String(failure.reason ?? failure.error ?? 'Push notification send failed'),
      );
    }
  }

  protected aggregateUserSendResults(
    tokens: NotificationToken[],
    results: IPushBatchResult[],
    requestedCount: number,
  ): IPushSendAggregateResult {
    const failedTokens = new Set(
      this.mergeBatchResults(results).failures.map(failure => failure.token),
    );
    const usersById = groupBy(tokens, token => token.userId.toString());
    let successCount = 0;
    for (const userTokens of Object.values(usersById)) {
      if (userTokens.some(token => !failedTokens.has(token.token))) {
        successCount++;
      }
    }
    const usersWithTokens = Object.keys(usersById).length;
    return {
      requestedCount,
      successCount,
      failureCount: usersWithTokens - successCount,
      skippedCount: requestedCount - usersWithTokens,
    };
  }

  protected aggregateNotificationSendResults(
    outcomes: { success: boolean; skipped: boolean }[],
  ): IPushSendAggregateResult {
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    for (const outcome of outcomes) {
      if (outcome.skipped) skippedCount++;
      else if (outcome.success) successCount++;
      else failureCount++;
    }
    return {
      requestedCount: outcomes.length,
      successCount,
      failureCount,
      skippedCount,
    };
  }

  protected async storeNotifications(
    notifications: {
      user: string | User;
      title?: string;
      body?: string;
      data?: any;
      platform?: string | PlatformTypesEnum;
    }[],
  ): Promise<void> {
    for (const batch of this.chunkItems(notifications)) {
      await Notification.getInstance().createMany(batch);
    }
  }

  async sendToDevice(params: ISendNotification): Promise<any> {
    if (!this._initialized) throw new Error('Provider not initialized');
    const { sendTo } = params;
    if (isNil(sendTo)) return;
    validateNotification(params);
    if (!params.doNotStore || !params.isSilent) {
      await Notification.getInstance().create({
        user: params.sendTo,
        title: params.title,
        body: params.body,
        data: params.data,
        platform: params.platform,
      });
    }
    if (this.isBaseProvider) return;
    const notificationTokens = await this.fetchTokens(sendTo, params.platform);
    if (notificationTokens.length === 0) {
      throw new Error('No notification token found');
    }
    const results = await this.dispatchSendMessages(
      this.toTokenTargets(notificationTokens),
      params,
    );
    this.logBatchFailures(results);
  }

  fetchTokens(users: string | string[], platform?: string): Promise<NotificationToken[]> {
    if (Array.isArray(users)) {
      return this.fetchTokensForUsers(users, platform);
    }
    return NotificationToken.getInstance().findMany(
      {
        userId: users as string,
        ...(platform ? { platform } : {}),
      },
      { readPreference: 'primary' },
    );
  }

  protected async fetchTokensForUsers(
    users: string[],
    platform?: string,
  ): Promise<NotificationToken[]> {
    if (users.length === 0) return [];
    const tokens: NotificationToken[] = [];
    for (const userBatch of this.chunkItems(users)) {
      const batch = await NotificationToken.getInstance().findMany(
        {
          userId: { $in: userBatch },
          ...(platform ? { platform } : {}),
        },
        { readPreference: 'primary' },
      );
      tokens.push(...batch);
    }
    return tokens;
  }

  async sendMany(params: ISendNotification[]): Promise<IPushSendAggregateResult> {
    if (!this._initialized) throw new Error('Provider not initialized');
    const notifications: {
      user: string | User;
      title?: string;
      body?: string;
      data?: any;
      platform?: string | PlatformTypesEnum;
    }[] = [];
    params.forEach(param => {
      validateNotification(param);
      if (param.doNotStore || param.isSilent) return;
      notifications.push({
        user: param.sendTo,
        title: param.title,
        body: param.body,
        data: param.data,
        platform: param.platform,
      });
    });
    if (notifications.length !== 0) {
      await this.storeNotifications(notifications);
    }
    if (this.isBaseProvider) {
      return {
        requestedCount: params.length,
        successCount: notifications.length,
        failureCount: 0,
        skippedCount: params.length - notifications.length,
      };
    }

    const tokenCache = new Map<string, NotificationToken[]>();
    const uniqueUserIds = [...new Set(params.map(param => param.sendTo))];
    for (const userBatch of this.chunkItems(uniqueUserIds)) {
      this.mergeTokensIntoCache(tokenCache, await this.fetchTokensForUsers(userBatch));
    }
    if (tokenCache.size === 0) throw new Error('Could not find tokens');

    const outcomes: { success: boolean; skipped: boolean }[] = [];
    for (const paramBatch of this.chunkItems(params)) {
      const batchOutcomes = await this.mapWithConcurrency(
        paramBatch,
        SEND_CONCURRENCY,
        async param => {
          const userTokens = tokenCache.get(param.sendTo) ?? [];
          const applicable = userTokens.filter(
            (token: NotificationToken) =>
              !param.platform || param.platform === token.platform,
          );
          if (applicable.length === 0) {
            return { success: false, skipped: true };
          }

          const results = await this.dispatchSendMessages(
            this.toTokenTargets(applicable),
            param,
          );
          this.logBatchFailures(results);
          const merged = this.mergeBatchResults(results);
          return { success: merged.successCount > 0, skipped: false };
        },
      );
      outcomes.push(...batchOutcomes);
    }

    return this.aggregateNotificationSendResults(outcomes);
  }

  async sendToManyDevices(
    params: ISendNotificationToManyDevices,
  ): Promise<IPushSendAggregateResult> {
    if (!this._initialized) throw new Error('Provider not initialized');

    validateNotification(params);
    if (!params.doNotStore && !params.isSilent) {
      await this.storeNotifications(
        params.sendTo.map(userId => ({
          user: userId,
          title: params.title,
          body: params.body,
          data: params.data,
          platform: params.platform,
        })),
      );
    }
    if (this.isBaseProvider) {
      const storedCount = params.doNotStore || params.isSilent ? 0 : params.sendTo.length;
      return {
        requestedCount: params.sendTo.length,
        successCount: storedCount,
        failureCount: 0,
        skippedCount: params.sendTo.length - storedCount,
      };
    }

    const notificationTokens = await this.fetchTokensForUsers(
      params.sendTo,
      params.platform,
    );
    if (notificationTokens.length === 0) throw new Error('Could not find tokens');

    const results = await this.dispatchSendMessages(
      this.toTokenTargets(notificationTokens),
      params,
    );
    this.logBatchFailures(results);
    return this.aggregateUserSendResults(
      notificationTokens,
      results,
      params.sendTo.length,
    );
  }
}
