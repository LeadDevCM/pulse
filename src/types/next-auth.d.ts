import { DefaultSession } from "next-auth";
import { Role } from "./index";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      clinicianId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    clinicianId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    clinicianId?: string;
  }
}
