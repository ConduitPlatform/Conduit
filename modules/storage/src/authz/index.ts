import { ConduitAuthorizedResource } from '@conduitplatform/grpc-sdk';

export const ContainerResource = new ConduitAuthorizedResource(
  'Container',
  {
    owner: ['*'],
    reader: ['*'],
    editor: ['*'],
  },
  {
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
  },
);

export const FolderResource = new ConduitAuthorizedResource(
  'Folder',
  {
    owner: ['*'],
    reader: ['*'],
    editor: ['*'],
  },
  {
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
  },
);

export const FileResource = new ConduitAuthorizedResource(
  'File',
  {
    owner: ['*'],
    reader: ['*'],
    editor: ['*'],
  },
  {
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
  },
);
