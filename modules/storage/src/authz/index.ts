import { ConduitAuthorizedResource } from '@conduitplatform/grpc-sdk';

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
