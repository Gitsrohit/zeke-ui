import { recordAudit } from "@/features/audit/services/audit.service";
import {
  findMembershipByInviteHash,
  findSystemRoleId,
  findUserByEmail,
  findUserByGoogleSubject,
  insertMembership,
  insertUser,
  listActiveMemberships,
  updateMembership,
  updateUser,
} from "@/features/users/repositories/user.repository";
import { provisionOrganization } from "@/features/users/services/provisioning.service";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db/client";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import type { ServiceContext } from "@/lib/server/context";
import type { AcceptInviteInput, LoginInput, SignupInput } from "./schemas";

export interface AuthenticatedPrincipal {
  userId: string;
  organizationId: string;
}

const INVITE_TTL_DAYS = 14;

function actorContext(organizationId: string, userId: string, userName: string): ServiceContext {
  return { organizationId, userId, userName, role: "owner", permissions: ROLE_PERMISSIONS.owner, segmentScope: [] };
}

export async function authenticateWithPassword(input: LoginInput): Promise<AuthenticatedPrincipal> {
  const user = await findUserByEmail(db, input.email);
  const valid = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !valid) throw new UnauthorizedError("Invalid email or password.");
  const [membership] = await listActiveMemberships(db, user.id);
  if (!membership) throw new UnauthorizedError("Your access to this workspace has been deactivated. Contact your administrator.");
  return { userId: user.id, organizationId: membership.organizationId };
}

/** Self-serve signup creates a brand-new tenant with the signer as Owner. */
export async function registerOrganization(input: SignupInput): Promise<AuthenticatedPrincipal> {
  if (await findUserByEmail(db, input.email)) {
    throw new ConflictError("An account with this email already exists. Sign in instead.", { fieldErrors: { email: ["An account with this email already exists"] } });
  }
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const user = await insertUser(tx, { email: input.email.toLowerCase(), name: input.name, passwordHash });
    const org = await provisionOrganization(tx, { name: input.organizationName, createdById: user.id });
    await insertMembership(tx, { organizationId: org.organizationId, userId: user.id, roleId: await findSystemRoleId(tx, "owner"), title: "Owner", status: "active" });
    await recordAudit(tx, actorContext(org.organizationId, user.id, user.name), {
      action: "organization.created",
      entityType: "organization",
      entityId: org.organizationId,
      summary: `${input.organizationName} workspace created by ${user.name}`,
    });
    return { userId: user.id, organizationId: org.organizationId };
  });
}

export async function getInvitation(token: string) {
  const invite = await findMembershipByInviteHash(db, hashToken(token));
  if (!invite || invite.status !== "invited") return null;
  const expired = Date.now() - invite.createdAt.getTime() > INVITE_TTL_DAYS * 86_400_000;
  return { ...invite, expired };
}

export async function acceptInvitation(input: AcceptInviteInput): Promise<AuthenticatedPrincipal> {
  const invite = await getInvitation(input.token);
  if (!invite) throw new NotFoundError("Invitation");
  if (invite.expired) throw new ConflictError("This invitation has expired. Ask your administrator to send a new one.");
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await updateUser(tx, invite.userId, { name: input.name, passwordHash });
    await updateMembership(tx, invite.organizationId, invite.membershipId, { status: "active", inviteTokenHash: null, lastActiveAt: new Date() });
    await recordAudit(tx, actorContext(invite.organizationId, invite.userId, input.name), {
      action: "user.invite_accepted",
      entityType: "user",
      entityId: invite.userId,
      summary: `${input.name} accepted their invitation`,
    });
  });
  return { userId: invite.userId, organizationId: invite.organizationId };
}

export interface GoogleProfile {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

/**
 * Signs in with Google. Links to an existing account by verified email, or
 * creates a new user and workspace on first sign-in.
 */
export async function authenticateWithGoogle(profile: GoogleProfile): Promise<AuthenticatedPrincipal> {
  if (!profile.emailVerified) throw new UnauthorizedError("Your Google email address is not verified.");
  let user = await findUserByGoogleSubject(db, profile.subject);
  if (!user) {
    const byEmail = await findUserByEmail(db, profile.email);
    if (byEmail) {
      await updateUser(db, byEmail.id, { googleSubject: profile.subject, avatarUrl: byEmail.avatarUrl ?? profile.picture });
      user = { ...byEmail, googleSubject: profile.subject };
    }
  }
  if (user) {
    const [membership] = await listActiveMemberships(db, user.id);
    if (membership) return { userId: user.id, organizationId: membership.organizationId };
    // Invited users completing sign-up via Google.
    throw new UnauthorizedError("You don't have an active workspace. Use your invitation link or ask an administrator.");
  }
  return db.transaction(async (tx) => {
    const created = await insertUser(tx, { email: profile.email.toLowerCase(), name: profile.name, googleSubject: profile.subject, avatarUrl: profile.picture });
    const org = await provisionOrganization(tx, { name: `${profile.name.split(" ")[0]}'s Workspace`, createdById: created.id });
    await insertMembership(tx, { organizationId: org.organizationId, userId: created.id, roleId: await findSystemRoleId(tx, "owner"), title: "Owner", status: "active" });
    return { userId: created.id, organizationId: org.organizationId };
  });
}
