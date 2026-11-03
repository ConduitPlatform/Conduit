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
  UserChangeEmailResponse,
} from '../../protoUtils/index.js';
import { Indexable } from '../../interfaces/index.js';
import type { UserCache } from '../../utilities/UserCache.js';
import { GrpcError } from '../../types/index.js';
import { status } from '@grpc/grpc-js';

export class Authentication extends ConduitModule<typeof AuthenticationDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'authentication', url, grpcToken);
    this.initializeClient(AuthenticationDefinition);
  }

  private userCacheProvider?: () => UserCache | undefined;

  /**
   * Attaches a cache (or a lazy provider of one, resolved on every `getUser` call so that
   * no Redis connection is opened until it is needed) that `getUser` reads through.
   */
  attachUserCache(cache: UserCache | (() => UserCache | undefined) | undefined) {
    this.userCacheProvider =
      typeof cache === 'function' ? cache : cache ? () => cache : undefined;
  }

  hasUserCache(): boolean {
    return this.userCacheProvider !== undefined;
  }

  /**
   * Fetches a user document (never includes `hashedPassword`), reading through the
   * attached user cache (5 s TTL, see UserCache) when there is one. Cache problems never
   * fail or delay the call beyond the cache's own timeout; the cache write is fire-and-forget.
   *
   * The server answers gRPC NOT_FOUND for an unknown id and this method rejects with that
   * error (an empty response is also turned into a `GrpcError` NOT_FOUND).
   */
  async getUser(userId: string): Promise<Indexable> {
    let cache: UserCache | undefined;
    try {
      cache = this.userCacheProvider?.();
    } catch {
      cache = undefined;
    }
    const cached = await cache?.get(userId);
    if (cached) return cached;
    const res = await this.client!.getUser({ userId });
    if (!res?.user) {
      throw new GrpcError(status.NOT_FOUND, 'User not found');
    }
    const user = JSON.parse(res.user) as Indexable;
    void cache?.set(userId, user);
    return user;
  }

  /**
   * Issues tokens for a user without a login. Trusted path: it runs no login strategy
   * and satisfies a realm's `requireTwoFa` policy without a 2FA step. `realm` (slug)
   * defaults to the user's home realm.
   */
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

  /**
   * Sets a new password. `realm` picks the account when the email is held by several accounts
   * (isolated identity mode): a realm slug picks that realm's account, `'global'` picks the
   * account without a home realm. Without it such an email is refused with FAILED_PRECONDITION.
   */
  changePass(
    email: string,
    password?: string,
    realm?: string,
  ): Promise<UserCreateResponse> {
    return this.client!.changePass({ email, password, realm });
  }

  changeEmail(userId: string, newEmail: string): Promise<UserChangeEmailResponse> {
    return this.client!.changeEmail({ userId, newEmail });
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
   * Errors keep their gRPC code; module errors (REALM_SLUG_TAKEN, REALM_NESTED,
   * GUESTS_NOT_ALLOWED...) carry a JSON string message (`{"conduitCode", "message"}`),
   * so key on `conduitCode`.
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

  /**
   * `home` makes the realm the user's home realm, `guest` adds a guest membership.
   * Fails with FAILED_PRECONDITION when `home` would replace a different home realm
   * (unless `force`, which moves the user and revokes all their tokens) and when `guest`
   * is requested for a user whose home realm is this realm.
   * Errors keep their gRPC code; module errors carry a JSON string message
   * (`{"conduitCode", "message"}`), so key on `conduitCode`.
   */
  grantRealmMembership(
    teamId: string,
    userId: string,
    type: 'home' | 'guest',
    force: boolean = false,
  ) {
    return this.client!.grantRealmMembership({ teamId, userId, type, force });
  }

  /** Removes a guest membership (home users are moved, not removed). */
  revokeRealmMembership(teamId: string, userId: string) {
    return this.client!.revokeRealmMembership({ teamId, userId, type: '', force: false });
  }
}
