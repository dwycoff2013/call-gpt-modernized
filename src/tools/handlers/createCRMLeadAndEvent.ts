import { findCrmLeadByEmail, createCrmLead, createCrmEvent } from './zoho_crm';
import type { ToolHandler } from '../../types/index';

interface CreateCrmLeadAndEventArgs {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  event_title: string;
  start_datetime: string;
  end_datetime: string;
  appointment_type: string;
  staff_member: string;
}

interface CreateCrmLeadAndEventResult {
  status: string;
  lead_id?: string;
  event_id?: string;
  message?: string;
}

const createCrmLeadAndEvent: ToolHandler = async (args): Promise<CreateCrmLeadAndEventResult> => {
  const typedArgs = args as unknown as CreateCrmLeadAndEventArgs;
  const { 
    first_name, 
    last_name, 
    email, 
    phone, 
    event_title, 
    start_datetime, 
    end_datetime, 
    appointment_type, 
    staff_member 
  } = typedArgs;

  try {
    const lead = await findCrmLeadByEmail(email);
    let leadId: string;

    if (lead) {
      console.log(`Found existing lead with ID: ${lead.id}`);
      leadId = lead.id;
    } else {
      console.log('No existing lead found. Creating a new one...');
      const leadDetails = { first_name, last_name, email, phone };
      leadId = await createCrmLead(leadDetails);
      console.log(`Successfully created new lead with ID: ${leadId}`);
    }

    const eventDetails = {
      event_title,
      start_datetime,
      end_datetime,
      lead_id: leadId,
      appointment_type,
      staff_member,
    };

    const eventId = await createCrmEvent(eventDetails);
    console.log(`Successfully created event with ID: ${eventId}`);
    return { status: 'success', lead_id: leadId, event_id: eventId };
  } catch (error) {
    console.error('Error in createCrmLeadAndEvent:', error);
    return { status: 'error', message: (error as Error).message };
  }
};

export default createCrmLeadAndEvent;
