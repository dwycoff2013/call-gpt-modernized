describe('checkAvailability datetime validation', () => {
  it('returns user-safe message for invalid datetimes', async () => {
    process.env.ZOHO_CLIENT_ID = 'x';
    process.env.ZOHO_CLIENT_SECRET = 'y';
    process.env.ZOHO_REFRESH_TOKEN = 'z';

    const module = await import('../src/tools/handlers/checkAvailability.js');
    const checkAvailability = module.default;

    const result = await checkAvailability({
      start_datetime: 'not-a-date',
      end_datetime: 'also-not-a-date',
    });

    expect(result).toEqual({
      is_available: false,
      message: 'I need a valid appointment date and time before I can check availability.',
    });
  });
});
