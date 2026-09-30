import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentUserData {
  id: string;
  email: string;
  fullName: string;
}

/** The authenticated user, resolved regardless of whether they have an active tenant yet. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): CurrentUserData => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
