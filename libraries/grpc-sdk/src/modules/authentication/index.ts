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
} from '../../protoUtils/index.js';
import { Indexable } from '../../interfaces';

export class Authentication extends ConduitModule<typeof AuthenticationDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'authentication', url, grpcToken);
    this.initializeClient(AuthenticationDefinition);
  }

  userLogin(userId: string, clientId: string): Promise<UserLoginResponse> {
    return this.client!.userLogin({ userId, clientId });
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
  ): Promise<UserCreateResponse> {
    return this.client!.userCreate({
      email,
      verify,
      password,
      anonymousId,
      userData: JSON.stringify(userData),
    });
  }

  userCreateByUsername(
    username: string,
    password?: string,
    anonymousId?: string,
  ): Promise<UserCreateResponse> {
    return this.client!.userCreateByUsername({ username, password, anonymousId });
  }

  anonymousUserCreate(clientId: string): Promise<UserLoginResponse> {
    return this.client!.anonymousUserCreate({ clientId });
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
}
