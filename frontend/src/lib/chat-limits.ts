/** Longest message the API accepts (Backend/app/routers/chat.py MAX_MESSAGE_CHARS). */
export const MAX_MESSAGE_CHARS = 200_000;

/** The counter appears once a message uses 90% of the limit. */
export function messageCounter(length: number): { show: boolean; over: boolean; text: string } {
  return {
    show: length >= MAX_MESSAGE_CHARS * 0.9,
    over: length > MAX_MESSAGE_CHARS,
    text: `${length.toLocaleString("en-US")} / ${MAX_MESSAGE_CHARS.toLocaleString("en-US")}`,
  };
}
