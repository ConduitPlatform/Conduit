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
    read: [
      'owner->manageSubTeams',
      'owner',
      'owner->viewSubTeams',
      'readAll',
      'owner->readAll',
      'editAll',
      'owner->editAll',
    ],
    edit: ['owner', 'owner->manageSubTeams', 'editAll', 'owner->editAll'],
    delete: ['owner', 'owner->manageSubTeams'],
    invite: ['owner', 'editAll', 'owner->editAll'],
    viewMembers: [
      'member',
      'owner',
      'owner->viewMembers',
      'readAll',
      'owner->readAll',
      'editAll',
      'owner->editAll',
    ],
    viewSubTeams: [
      'owner->manageSubTeams',
      'owner',
      'readAll',
      'owner->readAll',
      'editAll',
      'owner->editAll',
    ],
    manageSubTeams: ['owner->manageSubTeams', 'owner', 'editAll', 'owner->editAll'],
  },
);
