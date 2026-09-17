import { redirect } from "next/navigation";

/** The chat workspace lives at /home; /chat is the friendlier public name
 * used by the pricing page's "Go to workspace" CTA. */
export default function ChatPage() {
  redirect("/home");
}
