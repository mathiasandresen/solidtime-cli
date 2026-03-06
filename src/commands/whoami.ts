import { getOutputMode } from "../flags";
import { printJson, printKeyValue } from "../output";
import type { CliFlags, CommandContext } from "../types";

export async function handleWhoAmI(flags: CliFlags, context: CommandContext) {
  const payload = {
    user: context.me,
    organization: context.membership.organization,
    role: context.membership.role,
    member: {
      id: context.member.id,
      name: context.member.name,
      email: context.member.email,
      role: context.member.role,
    },
  };

  if ((getOutputMode(flags) ?? context.config.output) === "json") {
    printJson(payload);
    return;
  }

  printKeyValue([
    ["user", context.me.name],
    ["email", context.me.email],
    ["timezone", context.me.timezone],
    ["organization", context.membership.organization.name],
    ["organizationId", context.membership.organization.id],
    ["memberRole", context.member.role],
    ["memberId", context.member.id],
  ]);
}
