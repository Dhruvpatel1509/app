import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processReceiptWithVeryfi } from '@/lib/veryfi';

describe('Veryfi OCR request format', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.VERYFI_CLIENT_ID = 'client-id';
    process.env.VERYFI_CLIENT_SECRET = 'client-secret';
    process.env.VERYFI_USERNAME = 'username';
    process.env.VERYFI_API_KEY = 'api-key';
  });

  it('sends the documented JSON payload with a base64 file_data field', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: 123,
        vendor: { name: 'Test Vendor' },
        date: '2026-10-27',
        currency_code: 'EUR',
        subtotal: 10,
        tax: 0,
        tip: 0,
        discount: 0,
        total: 10,
        line_items: [],
      }),
    }));

    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['hello'], 'receipt.png', { type: 'image/png' });

    await processReceiptWithVeryfi(file);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    const body = JSON.parse(String(init?.body));
    expect(body.file_name).toBe('receipt.png');
    expect(body.file_data).toBe(Buffer.from('hello').toString('base64'));
    expect(body.categories).toEqual([
      'Grocery',
      'Restaurant',
      'Utilities',
      'Transportation',
      'Shopping',
    ]);
    expect(body.auto_delete).toBe(true);
    expect(body.country).toBeUndefined();
    expect(body.default_currency).toBeUndefined();
  });
});
