import { ConduitAuthorizedResource } from '@conduitplatform/grpc-sdk';

const storageRelations = {
  owner: ['*'],
  reader: ['*'],
  editor: ['*'],
};

const storagePermissions = {
  read: [
    'owner',
    'reader',
    'editor',
    'reader->read',
    'editor->edit',
    'owner->read',
    'owner->edit',
  ],
  edit: ['owner', 'editor', 'editor->edit', 'owner->edit'],
  delete: ['owner', 'owner->edit'],
};

export const ContainerResource = new ConduitAuthorizedResource(
  'Container',
  storageRelations,
  storagePermissions,
);

export const FolderResource = new ConduitAuthorizedResource(
  'Folder',
  storageRelations,
  storagePermissions,
);

export const FileResource = new ConduitAuthorizedResource(
  'File',
  storageRelations,
  storagePermissions,
);
