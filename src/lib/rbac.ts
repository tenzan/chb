export function hasRole(
  user: { roles: string[] },
  ...roles: string[]
): boolean {
  return user.roles.some((r) => roles.includes(r));
}
