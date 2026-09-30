import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "@/config/api";
import { clearReplyRating, myRatings, nextVote, rateReply, reasonLabel, savedReplyId } from "@/services/chatFeedback";

describe("which reply a vote is saved against", () => {
  it("uses the id the server saved the reply under", () => {
    expect(savedReplyId({ id: "1727000000001", role: "assistant", serverId: "msg_ab12cd34" })).toBe("msg_ab12cd34");
    // Loaded from the server: the id already is the saved one.
    expect(savedReplyId({ id: "msg_ab12cd34", role: "assistant" })).toBe("msg_ab12cd34");
  });

  it("has none for a reply that wasn't saved, or for the user's own message", () => {
    expect(savedReplyId({ id: "1727000000001", role: "assistant" })).toBeNull();
    expect(savedReplyId({ id: "msg_ab12cd34", role: "user" })).toBeNull();
  });
});

describe("clicking a thumb", () => {
  it("sets it, switches it, and clears it when clicked again", () => {
    expect(nextVote(null, "up")).toBe("up");
    expect(nextVote("up", "down")).toBe("down");
    expect(nextVote("down", "down")).toBeNull();
    expect(nextVote(undefined, "down")).toBe("down");
  });
});

describe("the API calls", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rates a reply with an optional reason", async () => {
    await rateReply("conv_1", "msg_1", "down", "too_long");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/chat/feedback`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ conversation_id: "conv_1", message_id: "msg_1", rating: "down", reason: "too_long" });
    await rateReply("conv_1", "msg_1", "up");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).reason).toBeNull();
  });

  it("clears and lists ratings by query string", async () => {
    await clearReplyRating("conv 1", "msg_1");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/chat/feedback?conversation_id=conv+1&message_id=msg_1`);
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(await myRatings("conv_1")).toEqual([]);
  });

  it("turns a failed save into an error the hook can undo", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Message not found" }), { status: 404 }));
    await expect(rateReply("conv_1", "msg_x", "up")).rejects.toThrow("Message not found");
  });
});

it("labels reason codes for people", () => {
  expect(reasonLabel("too_long")).toBe("Too long");
  expect(reasonLabel("unknown_code")).toBe("unknown_code");
});
