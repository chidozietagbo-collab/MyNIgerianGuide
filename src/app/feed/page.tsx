import { Rss } from "lucide-react";
import ComingSoon from "@/components/ComingSoon";

export default function FeedPage() {
  return (
    <ComingSoon
      icon={Rss}
      title="Your feed is on its way"
      description="Posts from businesses you follow will show up here. The social layer — posts, follows, and reviews — is being built in Milestone 3."
      milestone="Milestone 3"
    />
  );
}
