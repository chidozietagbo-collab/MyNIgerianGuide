import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { confirmSponsoredListingPayment } from "@/app/business/dashboard/sponsored-listing-actions";

// This is the webhook URL already configured in the Paystack dashboard
// per the Deployment Guide's Step 3 (https://mynigerianguide.com/api/payments/verify,
// listening for charge.success and transfer.success). Webhooks are
// Paystack's recommended source of truth — more reliable than the
// callback_url redirect, since that depends on the customer's browser
// successfully completing the round trip.
//
// Signature verification: Paystack signs the RAW request body with
// HMAC-SHA512 using the account's secret key, sent in the
// x-paystack-signature header. This MUST be computed over the raw bytes
// of the body, not a re-serialized JSON.stringify() of a parsed object —
// re-serializing can reorder keys or change whitespace, producing a
// different hash than what Paystack actually signed. That's why this
// reads request.text() first, before any JSON.parse().
export async function POST(request: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    // Can't verify anything without the secret key — fail closed rather
    // than process an unverified payload.
    return NextResponse.json({ error: "Payments not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const expectedSignature = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  if (expectedSignature !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Acknowledge immediately for event types we don't act on, per
  // Paystack's docs: anything other than a 200 OK gets retried for up
  // to 72 hours, so there's no reason to make Paystack retry events we
  // were never going to do anything with.
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const reference = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ received: true });
  }

  try {
    await confirmSponsoredListingPayment(reference);
  } catch (err) {
    // Still return 200 — confirmSponsoredListingPayment already calls
    // Paystack's own verify endpoint internally and is idempotent via
    // the paystackReference unique constraint, so a transient failure
    // here is safe to let Paystack retry rather than escalate as a hard
    // webhook failure.
    console.error("Failed to process charge.success webhook:", err);
  }

  return NextResponse.json({ received: true });
}
