import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { EmailRecord, EmailTemplate } from '../models/index.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { Config } from '../config/index.js';
import { ISendEmailParams } from '../interfaces/index.js';

export async function storeEmail(
  grpcSdk: ConduitGrpcSdk,
  messageId: string | undefined,
  template: EmailTemplate | null,
  contentFileId: string | undefined,
  params: ISendEmailParams,
) {
  const config = ConfigController.getInstance().config as Config;
  let newContentFile;
  if (!contentFileId && config.storeEmails.storage.enabled) {
    newContentFile = await grpcSdk.storage!.createFileByUrl(
      randomUUID(),
      config.storeEmails.storage.folder,
      config.storeEmails.storage.container,
    );
    const buffer = Buffer.from(JSON.stringify(params));
    await axios.put(newContentFile.uploadUrl, buffer, {
      headers: {
        'Content-Length': buffer.length,
        'x-ms-blob-type': 'BlockBlob',
      },
    });
  }
  const emailInfo = {
    messageId,
    template: template ? template._id : undefined,
    contentFile: contentFileId ?? newContentFile?.id,
    sender: params.sender,
    receiver: params.email,
    cc: params.cc,
    replyTo: params.replyTo,
    sendingDomain: config.sendingDomain,
  };
  await EmailRecord.getInstance().create(emailInfo);
}
