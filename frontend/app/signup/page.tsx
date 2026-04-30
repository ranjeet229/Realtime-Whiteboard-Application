import { redirect } from "next/navigation";

/** Signup was removed; send users to the home landing. */
export default function SignupRedirectPage() {
  redirect("/");
}
