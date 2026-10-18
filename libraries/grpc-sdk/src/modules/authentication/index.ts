import { ConduitModule } from '../../classes/index.js';
import {
  AuthenticationDefinition,
  TeamDeleteResponse,
  UserCreateResponse,
  UserDeleteResponse,
  UserLoginResponse,
  Team,
  ValidateAccessTokenResponse,
  UserModifyStatusResponse,
  InvitationDeleteResponse,
  InviteUserToTeamResponse,
  RealmResponse,
  UnsetTeamRealmResponse,
} from '../../protoUtils/index.js';
import { Indexable } from '../../interfaces/index.js';

export class Authentication extends ConduitModule<typeof AuthenticationDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'authentication', url, grpcToken);
    this.initializeClient(AuthenticationDefinition);
  }

  userLogin(
    userId: string,
    clientId: string,
    realm?: string,
  ): Promise<UserLoginResponse> {
    return this.client!.userLogin({ userId, clientId, realm });
  }

  userDelete(userId: string): Promise<UserDeleteResponse> {
    return this.client!.userDelete({ userId });
  }

  userCreate(
    email: string,
    verify: boolean = false,
    password?: string,
    anonymousId?: string,
    userData?: Indexable,
    realm?: string,
  ): Promise<UserCreateResponse> {
    return this.client!.userCreate({
      email,
      verify,
      password,
      anonymousId,
      userData: JSON.stringify(userData),
      realm,
    });
  }

  userCreateByUsername(
    username: string,
    password?: string,
    anonymousId?: string,
    realm?: string,
  ): Promise<UserCreateResponse> {
    return this.client!.userCreateByUsername({ username, password, anonymousId, realm });
  }

  anonymousUserCreate(clientId: string, realm?: string): Promise<UserLoginResponse> {
    return this.client!.anonymousUserCreate({ clientId, realm });
  }

  changePass(email: string, password?: string): Promise<UserCreateResponse> {
    return this.client!.changePass({ email, password });
  }

  getTeam(teamId: string): Promise<Team> {
    return this.client!.getTeam({ teamId });
  }

  createTeam(name: string, parentTeam?: string, isDefault: boolean = false) {
    return this.client!.createTeam({ name, parentTeam, isDefault });
  }

  teamDelete(teamId: string): Promise<TeamDeleteResponse> {
    return this.client!.teamDelete({ teamId });
  }

  addTeamMembers(teamId: string, memberIds: string[]) {
    return this.client!.addTeamMembers({ teamId, memberIds });
  }

  removeTeamMembers(teamId: string, memberIds: string[]) {
    return this.client!.removeTeamMembers({ teamId, memberIds });
  }

  validateAccessToken(
    accessToken: string,
    path?: string,
  ): Promise<ValidateAccessTokenResponse> {
    return this.client!.validateAccessToken({ accessToken, path });
  }

  userModifyStatus(userId: string, active: boolean): Promise<UserModifyStatusResponse> {
    return this.client!.userModifyStatus({ id: userId, active });
  }

  invitationDelete(teamId: string, email: string): Promise<InvitationDeleteResponse> {
    return this.client!.invitationDelete({ teamId, email });
  }

  inviteUserToTeam(
    teamId: string,
    email: string,
    role: string,
    inviterUserId: string,
    redirectUri?: string,
    userData?: Indexable,
  ): Promise<InviteUserToTeamResponse> {
    return this.client!.inviteUserToTeam({
      teamId,
      email,
      role,
      inviterUserId,
      redirectUri,
      userData: JSON.stringify(userData),
    });
  }

  updateTeam(teamId: string, name?: string, newParentTeamId?: string): Promise<Team> {
    return this.client!.updateTeam({ teamId, name, newParentTeamId });
  }

  /**
   * Turns a top-level team into a realm, or updates the settings of an existing realm.
   * `settings` is the realm settings body (strategies, policies, registration, active);
   * it may carry OAuth secrets (write-only). Changing the slug of an existing realm
   * needs `force`.
   */
  setTeamRealm(
    teamId: string,
    slug: string,
    settings?: Indexable,
    force: boolean = false,
  ): Promise<RealmResponse> {
    return this.client!.setTeamRealm({
      teamId,
      slug,
      settingsJson: settings === undefined ? undefined : JSON.stringify(settings),
      force,
    });
  }

  /** The team, its masked realm settings (`settingsJson`, no secrets) and user counts. */
  getRealmSettings(teamId: string): Promise<RealmResponse> {
    return this.client!.getRealmSettings({ teamId });
  }

  /** Demotes a realm. Refused while home users exist unless `force`, which blocks them. */
  unsetTeamRealm(
    teamId: string,
    force: boolean = false,
  ): Promise<UnsetTeamRealmResponse> {
    return this.client!.unsetTeamRealm({ teamId, force });
  }

  /** `home` makes the realm the user's home realm, `guest` adds a guest membership. */
  grantRealmMembership(teamId: string, userId: string, type: 'home' | 'guest') {
    return this.client!.grantRealmMembership({ teamId, userId, type });
  }

  /** Removes a guest membership (home users are moved, not removed). */
  revokeRealmMembership(teamId: string, userId: string) {
    return this.client!.revokeRealmMembership({ teamId, userId, type: '' });
  }
}
