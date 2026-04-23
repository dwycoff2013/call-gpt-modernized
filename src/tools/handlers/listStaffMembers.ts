import { listStaffMembers } from './zoho_crm';
import type { ToolHandler } from '../../types/index';

interface ListStaffMembersResult {
  status: string;
  staff_members: ReturnType<typeof listStaffMembers>;
}

const listStaffMembersHandler: ToolHandler = async (): Promise<ListStaffMembersResult> => {
  const staffMembers = listStaffMembers();

  return {
    status: 'success',
    staff_members: staffMembers,
  };
};

export default listStaffMembersHandler;
