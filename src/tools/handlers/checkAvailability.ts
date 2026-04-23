import { getEventsByTimeRange } from './zoho_crm';
import type { ToolHandler } from '../../types/index';

interface CheckAvailabilityArgs {
  start_datetime: string;
  end_datetime: string;
}

interface CheckAvailabilityResult {
  is_available: boolean;
  message: string;
}

const checkAvailability: ToolHandler = async (args): Promise<CheckAvailabilityResult> => {
  const { start_datetime, end_datetime } = args as unknown as CheckAvailabilityArgs;
  
  try {
    const conflictingEvents = await getEventsByTimeRange(start_datetime, end_datetime);

    if (conflictingEvents.length > 0) {
      return {
        is_available: false,
        message: 'I am sorry, but that time slot is not available. Please suggest another time.',
      };
    }

    return {
      is_available: true,
      message: 'That time slot is available.',
    };
  } catch (error) {
    console.error('Error checking availability:', error);
    const message = (error as Error).message;
    if (message.includes('ISO-8601')) {
      return {
        is_available: false,
        message: 'I need a valid appointment date and time before I can check availability.',
      };
    }

    return {
      is_available: false,
      message: 'I encountered an error while checking the calendar. Please try again.',
    };
  }
};

export default checkAvailability;
