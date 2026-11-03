import { redirect } from "next/navigation";

export default function RetentionRedirect() {
  redirect("/admin/clients");
}
