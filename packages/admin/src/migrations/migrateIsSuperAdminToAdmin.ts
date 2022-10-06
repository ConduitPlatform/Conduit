import { Admin } from '../models';
import { isNil } from 'lodash';

export async function migrateIsSuperAdminToAdmin() {
  const originalAdmin: Admin | null = await Admin.getInstance().findOne({
    username: 'admin',
  });
  if (isNil(originalAdmin)) return;
  originalAdmin.isSuperAdmin = true;
  await Admin.getInstance().findByIdAndUpdate(originalAdmin._id, originalAdmin);
}
