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
  params: ISendEmailParams,
  compiledSubject: string,
  compiledBody: string,
) {
  const config = ConfigController.getInstance().config as Config;
  let contentFile;
  if (config.storeEmails.storage.enabled) {
    contentFile = await grpcSdk.storage!.createFileByUrl(
      randomUUID(),
      config.storeEmails.storage.folder,
      config.storeEmails.storage.container,
    );
    const fileData = {
      compiledSubject,
      compiledBody,
      params,
    };
    const buffer = Buffer.from(JSON.stringify(fileData));
    await axios.put(contentFile.uploadUrl, buffer, {
      headers: {
        'Content-Length': buffer.length,
        'x-ms-blob-type': 'BlockBlob',
      },
    });
  }
  const emailInfo = {
    messageId,
    template: template ? template._id : undefined,
    contentFile: contentFile ? contentFile.id : undefined,
    sender: params.sender,
    receiver: params.email,
    cc: params.cc,
    replyTo: params.replyTo,
    sendingDomain: params.sendingDomain,
  };
  await EmailRecord.getInstance().create(emailInfo);
}
