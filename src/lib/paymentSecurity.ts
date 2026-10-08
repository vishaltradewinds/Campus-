import { createHmac, timingSafeEqual } from 'node:crypto';

export function razorpayWebhookDigest(rawBody: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer | string, signature: string, secret: string): boolean {
  const expected = razorpayWebhookDigest(rawBody, secret);
  const actual = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
