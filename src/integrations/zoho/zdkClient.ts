import { executeWithAuthRetry } from '../../tools/handlers/zoho_auth';
import type { CrmLead, EventDetails, LeadDetails } from '../../types/index';
import { getZohoBackend } from './backend';
import { callZohoMcpTool, normalizeMcpToolResult } from './mcpClient';

const ZOHO_API_DOMAIN = process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com';
const ZOHO_CRM_API_URL = `${ZOHO_API_DOMAIN.replace(/\/$/, '')}/crm/v2`; 

interface ZohoHttpResponse<T> {
  data?: T;
}

interface ZohoZdk {
  CRM?: {
    API?: {
      getAllRecords?: (params: Record<string, unknown>) => Promise<unknown>;
      searchRecord?: (params: Record<string, unknown>) => Promise<unknown>;
      insertRecord?: (params: Record<string, unknown>) => Promise<unknown>;
      coql?: (params: Record<string, unknown>) => Promise<unknown>;
    };
  };
}

interface ZohoCrmAdapter {
  createLead(leadDetails: LeadDetails): Promise<string>;
  createEvent(eventDetails: EventDetails): Promise<string>;
  findLeadByEmail(email: string): Promise<CrmLead | null>;
  getEventsByTimeRange(startDateTime: string, endDateTime: string): Promise<Array<{ id: string }>>;
}

function readZdkClient(): ZohoZdk | null {
  const candidate = (globalThis as Record<string, unknown>).ZDK;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  return candidate as ZohoZdk;
}

function withAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Zoho-oauthtoken ${token}`,
    'Content-Type': 'application/json',
  };
}

async function zohoRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  options: { params?: Record<string, string>; body?: unknown } = {},
): Promise<ZohoHttpResponse<T>> {
  return executeWithAuthRetry(async (token) => {
    const query = options.params ? `?${new URLSearchParams(options.params).toString()}` : '';
    const response = await fetch(`${ZOHO_CRM_API_URL}${path}${query}`, {
      method,
      headers: withAuthHeaders(token),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) {
      return {};
    }

    const parsed = (await response.json().catch(() => ({}))) as ZohoHttpResponse<T> & { code?: string };

    if (!response.ok) {
      const error = new Error(`Zoho API request failed (${response.status}) ${path}`) as Error & {
        response?: { status: number; data: unknown };
      };
      error.response = { status: response.status, data: parsed };
      throw error;
    }

    return parsed;
  });
}

class DirectZohoClient implements ZohoCrmAdapter {
  private readonly zdk: ZohoZdk | null;

  constructor() {
    this.zdk = readZdkClient();
  }

  async createLead(leadDetails: LeadDetails): Promise<string> {
    const crmData = {
      data: [{
        First_Name: leadDetails.first_name,
        Last_Name: leadDetails.last_name,
        Email: leadDetails.email,
        Phone: leadDetails.phone,
        Lead_Source: 'Phone Call Intake',
      }],
    };

    const zdkApi = this.zdk?.CRM?.API;
    if (zdkApi?.insertRecord) {
      const response = await zdkApi.insertRecord({ Entity: 'Leads', APIData: crmData.data[0], Trigger: [] }) as { data?: Array<{ status: string; details?: { id: string } }> };
      const result = response.data?.[0];
      if (result?.status === 'success' && result.details?.id) {
        return result.details.id;
      }
    }

    const response = await zohoRequest<{ data: Array<{ status: string; details: { id: string } }> }>('POST', '/Leads', { body: crmData });
    const result = response.data?.data?.[0];
    if (!result || result.status !== 'success') {
      throw new Error(`Error creating CRM lead: ${JSON.stringify(result)}`);
    }
    return result.details.id;
  }

  async createEvent(eventDetails: EventDetails): Promise<string> {
    const eventPayload: Record<string, unknown> = {
      Event_Title: eventDetails.event_title,
      Start_DateTime: eventDetails.start_datetime,
      End_DateTime: eventDetails.end_datetime,
    };

    if (eventDetails.appointment_type) {
      eventPayload.Resource_Id = eventDetails.appointment_type;
    }

    if (eventDetails.staff_member) {
      eventPayload.Staff_Id = eventDetails.staff_member;
    }

    if (eventDetails.lead_id) {
      eventPayload.$se_module = 'Leads';
      eventPayload.What_Id = { id: eventDetails.lead_id };
    }

    const zdkApi = this.zdk?.CRM?.API;
    if (zdkApi?.insertRecord) {
      const response = await zdkApi.insertRecord({ Entity: 'Events', APIData: eventPayload, Trigger: [] }) as { data?: Array<{ status: string; details?: { id: string } }> };
      const result = response.data?.[0];
      if (result?.status === 'success' && result.details?.id) {
        return result.details.id;
      }
    }

    const response = await zohoRequest<{ data: Array<{ status: string; details: { id: string } }> }>('POST', '/Events', { body: { data: [eventPayload] } });
    const result = response.data?.data?.[0];
    if (!result || result.status !== 'success') {
      throw new Error(`Error creating CRM event: ${JSON.stringify(result)}`);
    }
    return result.details.id;
  }

  async findLeadByEmail(email: string): Promise<CrmLead | null> {
    const zdkApi = this.zdk?.CRM?.API;
    if (zdkApi?.searchRecord) {
      const response = await zdkApi.searchRecord({ Entity: 'Leads', Type: 'email', Query: email }) as { data?: CrmLead[]; code?: string };
      if (response.code === 'NO_RECORDS_FOUND') {
        return null;
      }
      return response.data?.[0] || null;
    }

    try {
      const response = await zohoRequest<{ data: CrmLead[] }>('GET', '/Leads/search', { params: { email } });
      return response.data?.data?.[0] || null;
    } catch (error) {
      const typedError = error as { response?: { data?: { code?: string } } };
      if (typedError.response?.data?.code === 'NO_RECORDS_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getEventsByTimeRange(startDateTime: string, endDateTime: string): Promise<Array<{ id: string }>> {
    const query = `select id from Events where (Start_DateTime <= '${endDateTime}' and End_DateTime >= '${startDateTime}')`;
    const zdkApi = this.zdk?.CRM?.API;
    if (zdkApi?.coql) {
      const response = await zdkApi.coql({ select_query: query }) as { data?: Array<{ id: string }> };
      return response.data || [];
    }

    const response = await zohoRequest<{ data?: Array<{ id: string }> }>('POST', '/coql', { body: { select_query: query } });
    return response.data?.data || [];
  }
}

class McpZohoClient implements ZohoCrmAdapter {
  async createLead(leadDetails: LeadDetails): Promise<string> {
    const result = await callZohoMcpTool('createLead', { leadDetails });
    const parsed = normalizeMcpToolResult<{ id: string }>(result);
    return parsed.id;
  }

  async createEvent(eventDetails: EventDetails): Promise<string> {
    const result = await callZohoMcpTool('createEvent', { eventDetails });
    const parsed = normalizeMcpToolResult<{ id: string }>(result);
    return parsed.id;
  }

  async findLeadByEmail(email: string): Promise<CrmLead | null> {
    const result = await callZohoMcpTool('findLeadByEmail', { email });
    const parsed = normalizeMcpToolResult<{ lead: CrmLead | null }>(result);
    return parsed.lead;
  }

  async getEventsByTimeRange(startDateTime: string, endDateTime: string): Promise<Array<{ id: string }>> {
    const result = await callZohoMcpTool('getEventsByTimeRange', { startDateTime, endDateTime });
    const parsed = normalizeMcpToolResult<{ events: Array<{ id: string }> }>(result);
    return parsed.events;
  }
}

export class ZdkZohoClient implements ZohoCrmAdapter {
  private readonly directClient = new DirectZohoClient();
  private readonly mcpClient = new McpZohoClient();

  private getActiveClient(): ZohoCrmAdapter {
    return getZohoBackend() === 'mcp' ? this.mcpClient : this.directClient;
  }

  async createLead(leadDetails: LeadDetails): Promise<string> {
    return this.getActiveClient().createLead(leadDetails);
  }

  async createEvent(eventDetails: EventDetails): Promise<string> {
    return this.getActiveClient().createEvent(eventDetails);
  }

  async findLeadByEmail(email: string): Promise<CrmLead | null> {
    return this.getActiveClient().findLeadByEmail(email);
  }

  async getEventsByTimeRange(startDateTime: string, endDateTime: string): Promise<Array<{ id: string }>> {
    return this.getActiveClient().getEventsByTimeRange(startDateTime, endDateTime);
  }
}

export const zdkZohoClient = new ZdkZohoClient();
