import { AuthUser } from '../../models/authentication/AuthModels';

export const handleBlockTitle = (multiple: boolean, user: AuthUser) => {
  if (multiple) {
    return 'Toggle selected users';
  }
  return user.active ? 'User is Unblocked' : 'User is Blocked';
};

export const handleBlockDescription = (multiple: boolean, user: AuthUser) => {
  if (multiple) {
    return 'Are you sure you want to block/unblock the selected users?';
  }
  return user.active
    ? `Are you sure you want to block ${user.email}`
    : `Are you sure you want to unblock ${user.email}`;
};

export const handleBlockButton = (multiple: boolean, user: AuthUser) => {
  if (multiple) {
    return 'Toggle';
  }
  return user ? 'Block' : 'Unblock';
};

export const handleDeleteTitle = (multiple: boolean, user: AuthUser) => {
  if (multiple) {
    return 'Delete selected users';
  }
  return `Delete user ${user.email}`;
};

export const handleDeleteDescription = (multiple: boolean, user: AuthUser) => {
  if (multiple) {
    return 'Are you sure you want to delete the selected users?';
  }
  return `Are you sure you want to delete ${user.email}? 
    \ Active: ${user.active}
    \ Verified: ${user.isVerified}`;
};
