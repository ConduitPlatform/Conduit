import { Client } from '@sendgrid/client';
import type { SentMessageInfo, Transport } from 'nodemailer';
import { SendGridConfig } from './sendgrid.config.js';

type SendgridMailMessage = Parameters<Transport<SentMessageInfo>['send']>[0];

type Address = { name?: string; address: string };

type NormalizedMail = {
  subject?: string;
  text?: string;
  html?: string;
  from?: Address;
  replyTo?: Address;
  to?: Address[];
  cc?: Address[];
  bcc?: Address[];
  attachments?: Array<{
    content?: string;
    filename?: string;
    contentType?: string;
    cid?: string;
  }>;
  alternatives?: Array<{ content?: string; contentType?: string }>;
  icalEvent?: { content?: string; filename?: string };
  watchHtml?: string;
  normalizedHeaders?: Record<string, string>;
  messageId?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
};

function formatAddress(entry?: Address) {
  if (!entry) return undefined;
  return { email: entry.address, ...(entry.name ? { name: entry.name } : {}) };
}

function formatAddresses(entries?: Address[]) {
  if (!entries?.length) return undefined;
  return entries.map(formatAddress);
}

function buildBody(source: NormalizedMail): Record<string, unknown> {
  const personalization: Record<string, unknown> = {};
  const to = formatAddresses(source.to);
  if (to?.length) personalization.to = to;
  const cc = formatAddresses(source.cc);
  if (cc?.length) personalization.cc = cc;
  const bcc = formatAddresses(source.bcc);
  if (bcc?.length) personalization.bcc = bcc;
  if (source.subject) personalization.subject = source.subject;
  if (source.dynamicTemplateData) {
    personalization.dynamic_template_data = source.dynamicTemplateData;
  }

  const body: Record<string, unknown> = { personalizations: [personalization] };
  const from = formatAddress(source.from);
  if (from) body.from = from;
  const replyTo = formatAddress(source.replyTo);
  if (replyTo) body.reply_to = replyTo;
  if (source.subject) body.subject = source.subject;

  const content: Array<{ type: string; value: string }> = [];
  if (source.text) content.push({ type: 'text/plain', value: source.text });
  if (source.html) content.push({ type: 'text/html', value: source.html });
  for (const alt of source.alternatives ?? []) {
    if (alt.content && alt.contentType) {
      content.push({ type: alt.contentType, value: alt.content });
    }
  }
  if (source.watchHtml) {
    content.push({ type: 'text/watch-html', value: source.watchHtml });
  }
  if (content.length) body.content = content;
  if (source.templateId) body.template_id = source.templateId;

  if (source.attachments?.length) {
    body.attachments = source.attachments.map(entry => ({
      content: entry.content ?? '',
      filename: entry.filename ?? 'attachment',
      type: entry.contentType ?? 'application/octet-stream',
      disposition: entry.cid ? 'inline' : 'attachment',
      ...(entry.cid ? { content_id: entry.cid } : {}),
    }));
  }

  if (source.icalEvent?.content) {
    body.attachments = [
      ...((body.attachments as unknown[]) ?? []),
      {
        content: source.icalEvent.content,
        filename: source.icalEvent.filename ?? 'invite.ics',
        type: 'application/ics',
        disposition: 'attachment',
      },
    ];
  }

  const headers = { ...(source.normalizedHeaders ?? {}) };
  if (source.messageId) headers['message-id'] = source.messageId;
  if (Object.keys(headers).length) body.headers = headers;

  return body;
}

function toSentMessageInfo(response: {
  statusCode: number;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}): SentMessageInfo {
  const raw = response.headers['x-message-id'] ?? response.headers['X-Message-Id'];
  const messageId =
    typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;

  return [
    {
      caseless: { dict: { 'x-message-id': messageId } },
      headers: response.headers,
      statusCode: response.statusCode,
    },
    response.body,
  ] as SentMessageInfo;
}

class SendgridTransport implements Transport<SentMessageInfo> {
  readonly name = 'sendgrid';
  readonly version = '1.0.0';
  private readonly client: Client;

  constructor(sgSettings: SendGridConfig) {
    this.client = new Client();
    this.client.setDataResidency(sgSettings.residency);
    this.client.setApiKey(sgSettings.apiKey);
  }

  send(
    mail: SendgridMailMessage,
    callback: (err: Error | null, info?: SentMessageInfo) => void,
  ): void {
    mail.normalize((err, source) => {
      if (err) {
        callback(err);
        return;
      }

      this.client
        .request({
          method: 'POST',
          url: '/v3/mail/send',
          body: buildBody((source ?? {}) as NormalizedMail),
        })
        .then(([response]) => callback(null, toSentMessageInfo(response)))
        .catch(error => callback(error));
    });
  }
}

export function initialize(sgSettings: SendGridConfig): SendgridTransport {
  return new SendgridTransport(sgSettings);
}
