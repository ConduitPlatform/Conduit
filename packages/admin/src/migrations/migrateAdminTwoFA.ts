import { Admin } from '../models';

export async function migrateAdminTwoFA() {
  await Admin.getInstance().updateMany({ hasTwoFA: null }, { hasTwoFA: false });
}
