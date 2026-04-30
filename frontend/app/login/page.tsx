import { redirect } from "next/navigation";

/** Login was removed; send users to the home landing. */
export default function LoginRedirectPage() {
  redirect("/");
}
