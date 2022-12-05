import { ConduitAuthorizedResource } from '@conduitplatform/grpc-sdk';

export const User = new ConduitAuthorizedResource('User', {}, {});

export const Team = new ConduitAuthorizedResource(
  'Team',
  {
    member: 'User',
    owner: ['User', 'Team'],
  },
  {
    read: ['member', 'owner->read', 'owner'],
    edit: ['owner', 'owner->edit'],
    delete: ['owner', 'owner->delete'],
    invite: ['owner'],
  },
);
