"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

type Profile = {
  name: string | null;
  username: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
};

type AccountClientProps = {
  email: string;
  profile: Profile;
  updateProfile: (formData: FormData) => Promise<{ success: boolean }>;
  deleteAccount: () => Promise<void>;
};

export default function AccountClient({ email, profile, updateProfile, deleteAccount }: AccountClientProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleProfileSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      await updateProfile(formData);
      setSaved(true);
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-ink-900">Account settings</h1>
      <p className="mt-1 text-sm text-ink-500">{email}</p>

      {/* Profile */}
      <section className="mt-8 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-ink-900">Profile</h2>
        <form action={handleProfileSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink-700">
                Name
              </label>
              <input id="name" name="name" defaultValue={profile.name ?? ""} className={inputClass} />
            </div>
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-ink-700">
                Username
              </label>
              <input id="username" name="username" defaultValue={profile.username ?? ""} className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="bio" className="mb-1 block text-sm font-medium text-ink-700">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={3}
              defaultValue={profile.bio ?? ""}
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className="mb-1 block text-sm font-medium text-ink-700">
                City
              </label>
              <input id="city" name="city" defaultValue={profile.city ?? ""} className={inputClass} />
            </div>
            <div>
              <label htmlFor="state" className="mb-1 block text-sm font-medium text-ink-700">
                State
              </label>
              <input id="state" name="state" defaultValue={profile.state ?? ""} className={inputClass} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
            {saved && !isPending && <span className="text-sm text-green-600">Saved.</span>}
          </div>
        </form>
      </section>

      <ChangePasswordSection />
      <DeleteAccountSection deleteAccount={deleteAccount} />
    </main>
  );
}

function ChangePasswordSection() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword("");
    setSuccess(true);
  }

  return (
    <section className="mt-6 rounded-lg border border-ink-100 bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-ink-900">Change password</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-ink-700">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-ink-300 disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-600">Password updated.</p>}
    </section>
  );
}

function DeleteAccountSection({ deleteAccount }: { deleteAccount: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="mt-6 rounded-lg border border-red-100 bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-ink-900">Delete account</h2>
      <p className="mt-1 text-sm text-ink-500">
        This permanently deletes your account and profile. This can&apos;t be undone.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-red-50"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => deleteAccount())}
            className="rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Deleting…" : "Yes, permanently delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm font-medium text-ink-500 hover:text-ink-700"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
