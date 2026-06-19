import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import AccountClient from "@/components/AccountClient";
import { updateProfile, deleteAccount } from "./actions";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Belt-and-braces — middleware already keeps signed-out users away from
  // /account, but this page should never render without a user regardless.
  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, username: true, bio: true, city: true, state: true },
  });

  return (
    <AccountClient
      email={user.email ?? ""}
      profile={
        profile ?? { name: null, username: null, bio: null, city: null, state: null }
      }
      updateProfile={updateProfile}
      deleteAccount={deleteAccount}
    />
  );
}
