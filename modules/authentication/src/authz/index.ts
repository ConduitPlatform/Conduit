import { ConduitAuthorizedResource } from '@conduitplatform/grpc-sdk';

export const User = new ConduitAuthorizedResource('User', {}, {});

export const Team = new ConduitAuthorizedResource(
  'Team',
  {
    members: 'User',
    owner: ['User', 'Team'],
  },
  {
    read: ['members', 'owner->read', 'owner'],
    edit: ['owner', 'owner->edit'],
    delete: ['owner', 'owner->delete'],
    invite: ['owner'],
  },
);
