import { NextRequest, NextResponse } from "next/server";
import { confirmSponsoredListingPayment } from "@/app/business/dashboard/sponsored-listing-actions";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-n-igerian-guide.vercel.app";

// This is the callback_url Paystack redirects the BROWSER to after
// checkout — it's a convenience path for the customer, never the
// authoritative confirmation. Per Paystack's own docs: "Just because the
// callback_url was visited doesn't prove that transaction was
// successful" — so this still calls the real verify endpoint (via
// confirmSponsoredListingPayment) before treating anything as paid.
// /api/payments/verify (the webhook route) is the reliable path that
// doesn't depend on the customer's browser successfully completing the
// redirect at all.
export async function GET(request: NextRequest, { params }: { params: Promise<{ businessPageId: string }> }) {
  const { businessPageId } = await params;
  const reference = request.nextUrl.searchParams.get("reference");

  const dashboardUrl = `${SITE_URL}/business/dashboard/${businessPageId}`;

  if (!reference) {
    return NextResponse.redirect(`${dashboardUrl}?boost=missing_reference`);
  }

  try {
    const result = await confirmSponsoredListingPayment(reference);
    if (result.success) {
      return NextResponse.redirect(`${dashboardUrl}?boost=success`);
    }
    return NextResponse.redirect(`${dashboardUrl}?boost=failed`);
  } catch {
    // The webhook (api/payments/verify) may still confirm this payment
    // independently even if something goes wrong here — this redirect
    // just tells the customer something needs checking, it doesn't mean
    // the payment is necessarily lost.
    return NextResponse.redirect(`${dashboardUrl}?boost=error`);
  }
}
