import { Search } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function SearchPage() {
  return (
    <ComingSoon
      icon={Search}
      title="Business search is on its way"
      description="Directory search, filters, and business pages are being built in Milestone 2 — the keyword and category system is already designed."
      milestone="Milestone 2"
    />
  );
}
