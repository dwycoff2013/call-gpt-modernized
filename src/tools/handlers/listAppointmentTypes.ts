import { listAppointmentTypes } from './zoho_crm';
import type { ToolHandler } from '../../types/index';

interface ListAppointmentTypesResult {
  status: string;
  appointment_types: ReturnType<typeof listAppointmentTypes>;
}

const listAppointmentTypesHandler: ToolHandler = async (): Promise<ListAppointmentTypesResult> => {
  const appointmentTypes = listAppointmentTypes();

  return {
    status: 'success',
    appointment_types: appointmentTypes,
  };
};

export default listAppointmentTypesHandler;
