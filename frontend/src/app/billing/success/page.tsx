import { redirect } from "next/navigation";

/** Placeholder billing routes used to render bare text ("Payment Successful!"
 * with nothing verified behind it). Real checkout lives at /checkout and the
 * account's invoice list is in Settings > Billing, so anything still
 * pointed at this URL is sent there instead of showing a dead page. */
export default function SuccessRedirect() {
  redirect("/home");
}
