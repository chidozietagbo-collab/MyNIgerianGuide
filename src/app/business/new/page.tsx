import { Store } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function NewBusinessPage() {
  return (
    <ComingSoon
      icon={Store}
      title="Business page setup is on its way"
      description="The 7-step setup wizard for creating your business page is being built in Milestone 2. Your account is ready to go the moment it ships."
      milestone="Milestone 2"
    />
  );
}
