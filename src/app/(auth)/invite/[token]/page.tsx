import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInviteForm } from "@/features/auth/components/accept-invite-form";
import { getInvitation } from "@/features/auth/auth.service";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invite = token.length >= 20 ? await getInvitation(token) : null;

  if (!invite || invite.expired) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-bold">{invite?.expired ? "This invitation has expired" : "Invitation not found"}</h1>
        <p className="mt-2 text-[13px] text-foreground-muted">
          {invite?.expired ? "Invitations are valid for 14 days. Ask your administrator to send a new link." : "The link may have been used already or mistyped. Ask your administrator for a new one."}
        </p>
        <Link href="/login" className="mt-5 inline-block text-[13px] font-semibold text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-bold">Join {invite.organizationName}</h1>
      <p className="mt-1 mb-5 text-[13px] text-foreground-muted">
        You were invited as <b className="text-foreground">{invite.email}</b>. Set your name and password to finish.
      </p>
      <AcceptInviteForm token={token} defaultName={invite.name} />
    </>
  );
}
