import ConduitGrpcSdk, { ConfigController } from '@conduitplatform/grpc-sdk';
import { Team as TeamAuthz, User as UserAuthz } from '../authz';
import { Config } from '../config';
import { Team } from '../models';
import { TeamInviteTemplate } from '../templates';

export async function initializeTeams(grpcSdk: ConduitGrpcSdk) {
  await grpcSdk.authorization!.defineResource(UserAuthz);
  await grpcSdk.authorization!.defineResource(TeamAuthz);
  const config: Config = ConfigController.getInstance().config;
  if (!config.teams.enabled || !grpcSdk.isAvailable('authorization')) return;
  if (config.teams.enableDefaultTeam) {
    const existingTeam = await Team.getInstance().findOne({ isDefault: true });
    if (!existingTeam) {
      await Team.getInstance().create({
        name: 'Default Team',
        isDefault: true,
      });
    }
  }
  if (config.teams.invites.enabled && !config.teams.invites.sendEmail) {
    if (!config.teams.invites.sendEmail || !grpcSdk.isAvailable('email')) {
      ConduitGrpcSdk.Logger.warn(
        'Team invites are enabled, but email sending is disabled. No invites will be sent.',
      );
    }
    if (config.teams.invites.sendEmail) {
      grpcSdk.onceModuleUp('email', async () => {
        await grpcSdk.emailProvider!.registerTemplate(TeamInviteTemplate);
      });
    }
  }
  ConduitGrpcSdk.Logger.log('Teams are available');
}
