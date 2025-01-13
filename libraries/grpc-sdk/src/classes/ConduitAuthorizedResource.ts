import { Resource_Permission, Resource_Relation } from '../protoUtils/authorization.js';

export class ConduitAuthorizedResource {
  readonly name: string;
  readonly relations: Resource_Relation[] = [];
  readonly permissions: Resource_Permission[] = [];
  readonly version?: number;

  constructor(
    name: string,
    relations: { [field: string]: string | string[] },
    permissions: { [action: string]: string | string[] },
    version?: number,
  ) {
    this.name = name;
    this.relations = Object.keys(relations).map(relation => {
      return {
        name: relation,
        resourceType: Array.isArray(relations[relation])
          ? (relations[relation] as string[])
          : ([relations[relation]] as string[]),
      };
    });
    this.permissions = Object.keys(permissions).map(permission => {
      return {
        name: permission,
        roles: Array.isArray(permissions[permission])
          ? (permissions[permission] as string[])
          : ([permissions[permission]] as string[]),
      };
    });
    this.version = version;
  }
}
