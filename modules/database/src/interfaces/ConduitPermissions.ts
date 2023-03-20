export interface ConduitPermissions {
  canCreate?: boolean;
  canModify?: 'Everything' | 'Nothing' | 'ExtensionOnly';
  canDelete?: boolean;
  extendable?: boolean;
}
