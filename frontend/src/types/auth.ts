export type Role = "USER" | "ADMIN" | "SUPERADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
