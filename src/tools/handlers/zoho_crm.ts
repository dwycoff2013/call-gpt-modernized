import { zdkZohoClient } from '../../integrations/zoho/zdkClient';
import type {
  LeadDetails,
  EventDetails,
  CrmLead,
  AppointmentType,
  StaffMember,
} from '../../types/index';

function parseSelectionList(rawList: string | undefined): AppointmentType[] | StaffMember[] {
  if (!rawList) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawList);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to parse Zoho selection list JSON:', (error as Error).message);
    return [];
  }
}

export function listAppointmentTypes(): AppointmentType[] {
  return parseSelectionList(process.env.ZOHO_APPOINTMENT_TYPES);
}

export function listStaffMembers(): StaffMember[] {
  return parseSelectionList(process.env.ZOHO_STAFF_MEMBERS);
}

const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function validateIsoDateTime(value: string, label: string): void {
  if (!ISO_8601_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid ISO-8601 datetime string.`);
  }
}

interface ResolveSelectionParams {
  selection: string | undefined;
  list: AppointmentType[] | StaffMember[];
  idKeys: string[];
  label: string;
}

function resolveSelection({ selection, list, idKeys, label }: ResolveSelectionParams): string | null {
  if (!selection) {
    return null;
  }

  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`${label} list is not configured. Set the corresponding ZOHO_* environment variable to a valid JSON array.`);
  }

  const normalizedSelection = String(selection).trim().toLowerCase();
  const match = list.find((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const nameMatch = item.name && String(item.name).trim().toLowerCase() === normalizedSelection;
    if (nameMatch) {
      return true;
    }

    return idKeys.some((key) => {
      const value = (item as Record<string, unknown>)[key];
      return value && String(value).trim().toLowerCase() === normalizedSelection;
    });
  });

  if (!match) {
    const options = list
      .map((item) => (item as Record<string, unknown>).name || (item as Record<string, unknown>).id || (item as Record<string, unknown>).resource_id || (item as Record<string, unknown>).staff_id)
      .filter(Boolean)
      .join(', ');
    throw new Error(`${label} "${selection}" not found. Available options: ${options || 'none configured'}.`);
  }

  const idKey = idKeys.find((key) => (match as Record<string, unknown>)[key]);
  return idKey ? String((match as Record<string, unknown>)[idKey]) : selection;
}

export async function createCrmLead(leadDetails: LeadDetails): Promise<string> {
  return zdkZohoClient.createLead(leadDetails);
}

export async function createCrmEvent(eventDetails: EventDetails): Promise<string> {
  const appointmentTypes = listAppointmentTypes();
  const staffMembers = listStaffMembers();

  const resourceId = resolveSelection({
    selection: eventDetails.appointment_type,
    list: appointmentTypes,
    idKeys: ['resource_id', 'id'],
    label: 'Appointment type',
  });

  const staffId = resolveSelection({
    selection: eventDetails.staff_member,
    list: staffMembers,
    idKeys: ['staff_id', 'id'],
    label: 'Staff member',
  });

  return zdkZohoClient.createEvent({
    ...eventDetails,
    appointment_type: resourceId || undefined,
    staff_member: staffId || undefined,
  });
}

export async function findCrmLeadByEmail(email: string): Promise<CrmLead | null> {
  return zdkZohoClient.findLeadByEmail(email);
}

export async function getEventsByTimeRange(start_datetime: string, end_datetime: string): Promise<Array<{ id: string }>> {
  validateIsoDateTime(start_datetime, 'start_datetime');
  validateIsoDateTime(end_datetime, 'end_datetime');
  return zdkZohoClient.getEventsByTimeRange(start_datetime, end_datetime);
}

export { resolveSelection };
