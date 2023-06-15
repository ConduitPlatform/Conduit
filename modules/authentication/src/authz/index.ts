import { ConduitAuthorizedResource } from '@conduitplatform/grpc-sdk';

export const User = new ConduitAuthorizedResource('User', {}, {});

export const Team = new ConduitAuthorizedResource(
  'Team',
  {
    member: 'User',
    owner: ['User', 'Team'],
    readAll: ['User', 'Team'],
    editAll: ['User', 'Team'],
  },
  {
    read: ['owner', 'readAll', 'editAll', 'owner->read', 'owner->edit'],
    edit: ['owner', 'editAll', 'owner->edit'],
    delete: ['owner', 'owner->edit'],
    invite: ['owner', 'editAll', 'owner->edit'],
    viewMembers: ['member', 'owner', 'readAll', 'owner->read', 'editAll', 'owner->edit'],
    manageMembers: ['owner', 'owner->edit'],
    viewSubTeams: ['owner', 'readAll', 'editAll', 'owner->read', 'owner->edit'],
    manageSubTeams: ['owner', 'editAll', 'owner->edit'],
  },
);
