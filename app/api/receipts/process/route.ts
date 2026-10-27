import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toMinorUnits } from '@/lib/calculations';
import {
  getVeryfiCredentials,
  normalizeCurrencyCode,
  normalizeReceiptDate,
  processReceiptWithVeryfi,
} from '@/lib/veryfi';
import type { VeryfiReceiptResponse } from '@/lib/types';

const SAMPLE_OCR: VeryfiReceiptResponse = {
  id: 991823,
  vendor: { name: 'Bäckerei Schmidt' },
  date: new Date().toISOString().split('T')[0],
  currency_code: 'EUR',
  subtotal: 18.4,
  tax: 1.6,
  tip: 0,
  discount: 0,
  total: 20.0,
  line_items: [
    {
      id: 1,
      description: 'Vollkornbrot',
      quantity: 1,
      unit_price: 4.5,
      total: 4.5,
      category: 'grocery',
    },
    {
      id: 2,
      description: 'Käsebrötchen',
      quantity: 2,
      unit_price: 2.2,
      total: 4.4,
      category: 'grocery',
    },
    {
      id: 3,
      description: 'Cappuccino',
      quantity: 2,
      unit_price: 3.5,
      total: 7.0,
      category: 'dining',
    },
    {
      id: 4,
      description: 'Apfelstrudel',
      quantity: 1,
      unit_price: 2.5,
      total: 2.5,
      category: 'dining',
    },
  ],
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const isSample = formData.get('is_sample') === 'true';

    if (!isSample && !file) {
      return NextResponse.json({ error: 'Please upload a receipt image or PDF.' }, { status: 400 });
    }

    let ocrData: VeryfiReceiptResponse;

    if (isSample) {
      ocrData = SAMPLE_OCR;
    } else {
      if (!getVeryfiCredentials()) {
        return NextResponse.json(
          { error: 'Veryfi OCR is not configured. Add credentials in .env.local and restart the server.' },
          { status: 503 }
        );
      }

      try {
        ocrData = await processReceiptWithVeryfi(file as File);
      } catch (e: any) {
        console.error('Veryfi receipt processing failed:', e?.message || e);
        return NextResponse.json(
          { error: e?.message || 'Failed to scan receipt with Veryfi.' },
          { status: 502 }
        );
      }
    }

    let storagePath = 'samples/sample_receipt.jpg';

    if (file && !isSample) {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Receipt image upload failed:', uploadError.message);

        const bucketMissing = uploadError.message.toLowerCase().includes('bucket not found');
        const message = bucketMissing
          ? "The Supabase 'receipts' storage bucket is missing. Run supabase/migrations/004_receipts_storage.sql in your Supabase SQL Editor, then try again."
          : `Receipt image upload failed: ${uploadError.message}`;

        return NextResponse.json(
          { error: message },
          { status: bucketMissing ? 503 : 502 }
        );
      } else if (uploadData) {
        storagePath = uploadData.path;
      }
    }

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        storage_path: storagePath,
        merchant: ocrData.vendor?.name || ocrData.vendor?.raw_name || 'Scanned Merchant',
        receipt_date: normalizeReceiptDate(ocrData.date),
        currency_code: normalizeCurrencyCode(ocrData.currency_code),
        subtotal_minor: toMinorUnits(ocrData.subtotal || 0),
        tax_minor: toMinorUnits(ocrData.tax || 0),
        tip_minor: toMinorUnits(ocrData.tip || 0),
        discount_minor: toMinorUnits(Math.abs(ocrData.discount || 0)),
        grand_total_minor: toMinorUnits(ocrData.total || 0),
        processing_status: 'review_required',
        provider_document_id: ocrData.id != null ? String(ocrData.id) : null,
        ocr_raw: ocrData,
      })
      .select()
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: receiptError?.message || 'Failed to save receipt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      receiptId: receipt.id,
      receipt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
