import { describe, expect, it } from "vitest";
import { filterParams, reviewErrors, reviewPayload, type ReviewInput } from "@/services/reviews";

const base: ReviewInput = { rating: 5, title: "", body: "Really useful for coding help.", pros: [], cons: [], tags: [], is_public: true };

describe("reviewErrors", () => {
  it("accepts a normal review", () => {
    expect(reviewErrors(base)).toEqual({});
  });

  it("needs a rating and 20-5000 characters", () => {
    expect(reviewErrors({ ...base, rating: 0 }).rating).toMatch(/1 to 5/);
    expect(reviewErrors({ ...base, body: "   too short   " }).body).toMatch(/at least 20/);
    expect(reviewErrors({ ...base, body: "x".repeat(5001) }).body).toMatch(/under 5000/);
  });

  it("limits pros and cons, ignoring blank lines", () => {
    expect(reviewErrors({ ...base, pros: ["a", "", "b", " ", "c", "d", "e"] })).toEqual({});
    expect(reviewErrors({ ...base, pros: ["a", "b", "c", "d", "e", "f"] }).pros).toMatch(/Up to 5/);
    expect(reviewErrors({ ...base, cons: ["x".repeat(121)] }).cons).toMatch(/120/);
  });
});

describe("reviewPayload", () => {
  it("trims text, drops blank and repeated points, sends an empty title as null", () => {
    expect(reviewPayload({ ...base, title: "  ", body: "  Great for research work overall.  ", pros: ["Fast", " Fast ", "", "Accurate"], cons: ["\n"] })).toEqual({
      rating: 5, title: null, body: "Great for research work overall.", pros: ["Fast", "Accurate"], cons: [], tags: [], is_public: true,
    });
  });
});

describe("filterParams", () => {
  it("only sends the filters that are set", () => {
    expect(filterParams({ sort: "recent" }).toString()).toBe("limit=12&sort=recent");
    const params = filterParams({ sort: "helpful", rating: 4, tag: "coding", verified: true, days: 30, q: "  python " }, "abc", 5);
    expect(Object.fromEntries(params)).toEqual({ limit: "5", sort: "helpful", rating: "4", tag: "coding", verified: "true", days: "30", q: "python", cursor: "abc" });
    expect(filterParams({ tag: "", verified: false, q: "  " }).toString()).toBe("limit=12&sort=recent");
  });
});
