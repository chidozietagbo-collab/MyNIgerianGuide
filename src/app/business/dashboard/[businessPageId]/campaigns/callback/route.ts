import { NextRequest, NextResponse } from "next/server";
import { confirmCampaignPayment, confirmAddedTargetPayment } from "@/app/business/dashboard/campaign-actions";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-n-igerian-guide.vercel.app";

// This is the callback_url Paystack redirects the BROWSER to after
// checkout — for both a full campaign purchase (campaign_ reference)
// and adding a single target to an existing active campaign (addtarget_
// reference). Never the authoritative confirmation on its own — per
// Paystack's own docs: "Just because the callback_url was visited
// doesn't prove that transaction was successful" — so this still calls
// the real verify endpoint before treating anything as paid. Reuses the
// same ?boost= query param vocabulary as the original flow so the
// dashboard's existing banner logic works unchanged for both cases.
export async function GET(request: NextRequest, { params }: { params: Promise<{ businessPageId: string }> }) {
  const { businessPageId } = await params;
  const reference = request.nextUrl.searchParams.get("reference");

  const dashboardUrl = `${SITE_URL}/business/dashboard/${businessPageId}`;

  if (!reference) {
    return NextResponse.redirect(`${dashboardUrl}?boost=missing_reference`);
  }

  try {
    const result = reference.startsWith("addtarget_")
      ? await confirmAddedTargetPayment(reference)
      : await confirmCampaignPayment(reference);
    if (result.success) {
      return NextResponse.redirect(`${dashboardUrl}?boost=success`);
    }
    return NextResponse.redirect(`${dashboardUrl}?boost=failed`);
  } catch {
    return NextResponse.redirect(`${dashboardUrl}?boost=error`);
  }
}
