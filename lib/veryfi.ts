import crypto from 'crypto';
import type { VeryfiReceiptResponse } from './types';

const VERYFI_DOCUMENTS_URL = 'https://api.veryfi.com/api/v8/partner/documents';

export function getVeryfiCredentials() {
  const clientId = process.env.VERYFI_CLIENT_ID?.trim();
  const clientSecret = process.env.VERYFI_CLIENT_SECRET?.trim();
  const username = process.env.VERYFI_USERNAME?.trim();
  const apiKey = process.env.VERYFI_API_KEY?.trim();

  if (!clientId || !username || !apiKey) {
    return null;
  }

  return { clientId, clientSecret, username, apiKey };
}

function generateSignature(
  clientSecret: string,
  payload: Record<string, unknown>
) {
  const timestamp = Date.now();
  let payloadStr = `timestamp:${timestamp}`;

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    const serialized = Array.isArray(value)
      ? `[${value.map((item) => `'${String(item).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ')}]`
      : typeof value === 'boolean'
        ? value ? 'True' : 'False'
        : String(value);
    payloadStr += `,${key}:${serialized}`;
  }

  const signature = crypto
    .createHmac('sha256', clientSecret)
    .update(payloadStr)
    .digest('base64')
    .trim();

  return { timestamp, signature };
}

export function normalizeCurrencyCode(code?: string | null): string {
  if (!code) return 'EUR';
  const trimmed = code.trim().toUpperCase();
  if (trimmed === '€' || trimmed === 'EURO' || trimmed === 'EUROS') return 'EUR';
  return trimmed.length === 3 ? trimmed : 'EUR';
}

export function normalizeReceiptDate(date?: string | null): string {
  const fallback = new Date().toISOString().split('T')[0];
  if (!date) return fallback;
  const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : fallback;
}

export async function processReceiptWithVeryfi(
  file: File
): Promise<VeryfiReceiptResponse> {
  const credentials = getVeryfiCredentials();
  if (!credentials) {
    throw new Error('Veryfi credentials are not configured.');
  }

  const buffer = await file.arrayBuffer();
  const payload = {
    file_name: file.name || 'receipt.jpg',
    file_data: Buffer.from(buffer).toString('base64'),
    categories: ['Grocery', 'Restaurant', 'Utilities', 'Transportation', 'Shopping'],
    auto_delete: true,
  };

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'CLIENT-ID': credentials.clientId,
    AUTHORIZATION: `apikey ${credentials.username}:${credentials.apiKey}`,
  };

  const signedHeaders = { ...baseHeaders };
  if (credentials.clientSecret) {
    const { timestamp, signature } = generateSignature(
      credentials.clientSecret,
      payload
    );
    signedHeaders['X-Veryfi-Request-Timestamp'] = String(timestamp);
    signedHeaders['X-Veryfi-Request-Signature'] = signature;
  }

  let response = await fetch(VERYFI_DOCUMENTS_URL, {
    method: 'POST',
    headers: signedHeaders,
    body: JSON.stringify(payload),
  });

  // Standard API keys work without HMAC. Retry unsigned if the signature is rejected.
  if (response.status === 401 && credentials.clientSecret) {
    response = await fetch(VERYFI_DOCUMENTS_URL, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(payload),
    });
  }

  const rawText = await response.text();
  let parsed: VeryfiReceiptResponse & { error?: string; detail?: string; status?: string };

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Veryfi returned a non-JSON response (${response.status}). Try a clearer photo.`
    );
  }

  if (!response.ok) {
    const message =
      parsed.error || parsed.detail || parsed.status || `Veryfi request failed (${response.status}).`;
    throw new Error(message);
  }

  return parsed;
}
