import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { IStorageProvider, StorageConfig } from '../interfaces';
import { ConfigController, GrpcError, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';
import { isNil, isString } from 'lodash';
import { _StorageContainer, _StorageFolder, File } from '../../models';
import { status } from '@grpc/grpc-js';
import { FileDetails } from '../interfaces/FileDetails';

let mime = require('mime-types');

export async function streamToBuffer(readableStream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data: any) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

export async function getAwsAccountId(config: StorageConfig) {
  const iamClient = new IAMClient({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
  const res = await iamClient.send(new GetUserCommand({}));
  return res!.User!.UserId;
}

export async function preFileCreation(call: ParsedRouterRequest, storageProvider: IStorageProvider) {
  const { name, data, folder, container, isPublic } = call.request.params;
  let newFolder;
  const mimeType = mime.lookup(name);
  if (isNil(folder) || folder === "") {
    newFolder = '/';
  } else {
    newFolder = folder.trim().slice(-1) !== '/' ? folder.trim() + '/' : folder.trim();
  }
  let config = ConfigController.getInstance().config;
  let usedContainer = container;
  // the container is sent from the client
  if (isNil(usedContainer)) {
    usedContainer = config.defaultContainer;
  } else {
    let container = await _StorageContainer.getInstance().findOne({
      name: usedContainer,
    });
    if (!container) {
      if (!config.allowContainerCreation) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'Container creation is not allowed!',
        );
      }
      let exists = await storageProvider.containerExists(usedContainer);
      if (!exists) {
        await storageProvider.createContainer(usedContainer);
      }
      await _StorageContainer.getInstance().create({
        name: usedContainer,
        isPublic,
      });
    }
  }
  let exists;
  if (!isNil(folder)) {
    exists = await storageProvider
      .container(usedContainer)
      .folderExists(newFolder);
    if (!exists) {
      await _StorageFolder.getInstance().create({
        name: newFolder,
        container: usedContainer,
        isPublic,
      });
      await storageProvider.container(usedContainer).createFolder(newFolder);
    }
  }

  exists = await File.getInstance().findOne({
    name,
    container: usedContainer,
    folder: newFolder,
  });
  if (exists) {
    throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
  }
  if (!isString(data)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid data provided');
  }
  return { name, mimeType, isPublic, newFolder, usedContainer, data };
}

export async function storeToProvider(storageProvider: IStorageProvider, fileDetails: FileDetails, encoding: 'base64' | 'binary') {
  try {
    const buffer = Buffer.from(fileDetails.data, encoding);
    await storageProvider
      .container(fileDetails.usedContainer)
      .store((fileDetails.newFolder ?? '') + fileDetails.name, buffer, fileDetails.isPublic);
    let publicUrl = null;
    if (fileDetails.isPublic) {
      publicUrl = await storageProvider
        .container(fileDetails.usedContainer)
        .getPublicUrl((fileDetails.newFolder ?? '') + fileDetails.name);
    }

    return await File.getInstance().create({
      name: fileDetails.name,
      mimeType: fileDetails.mimeType,
      folder: fileDetails.newFolder,
      container: fileDetails.usedContainer,
      isPublic: fileDetails.isPublic,
      url: publicUrl,
      encoding: encoding,
    });
  } catch (e) {
    throw e;
  }
}