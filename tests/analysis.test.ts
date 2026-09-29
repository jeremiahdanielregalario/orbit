import { describe, expect, it } from "vitest";
import {
  compareSnapshots,
  csv,
  parseEntries,
  relationships,
  timeline,
} from "../src/lib/analysis";
const row = (value: string, timestamp = 1704067200) => ({
  string_list_data: [{ value, timestamp }],
});
const entries = (followers: unknown[] = [], following: unknown[] = []) => [
  { name: "followers_1.json", text: JSON.stringify(followers) },
  {
    name: "following.json",
    text: JSON.stringify({ relationships_following: following }),
  },
];
describe("Instagram export analysis", () => {
  it("normalizes and deduplicates usernames, then classifies all relationships", () => {
    const snapshot = parseEntries(
      entries(
        [row("ALICE"), row("alice"), row("bob")],
        [
          row("alice"),
          { title: "charlie", string_list_data: [{ timestamp: 1704067200 }] },
        ],
      ),
      "test",
    );
    const result = relationships(snapshot);
    expect(snapshot.followers).toHaveLength(2);
    expect(result.mutual.map((a) => a.username)).toEqual(["alice"]);
    expect(result.notFollowingBack.map((a) => a.username)).toEqual(["charlie"]);
    expect(result.youDontFollow.map((a) => a.username)).toEqual(["bob"]);
    expect(result.all).toHaveLength(3);
  });
  it("merges split follower files", () => {
    const files = entries([row("a")], [row("b")]);
    files.push({ name: "followers_2.json", text: JSON.stringify([row("b")]) });
    expect(relationships(parseEntries(files, "test")).mutual).toHaveLength(1);
  });
  it("rejects missing required files instead of returning false mismatches", () =>
    expect(() =>
      parseEntries([{ name: "following.json", text: "[]" }], "test"),
    ).toThrow("Missing followers"));
  it("accepts genuinely empty lists", () =>
    expect(relationships(parseEntries(entries(), "test")).all).toHaveLength(0));
  it("rejects skipped, malformed and unsafe account records", () => {
    expect(() => parseEntries(entries([row("=cmd()")], []), "test")).toThrow(
      "could not be read",
    );
    expect(() =>
      parseEntries([{ name: "followers_1.json", text: "oops" }], "test"),
    ).toThrow("not valid JSON");
    expect(() => parseEntries(entries([{}], []), "test")).toThrow();
  });
  it("rejects missing numbered parts", () =>
    expect(() =>
      parseEntries(
        [...entries(), { name: "followers_3.json", text: "[]" }],
        "test",
      ),
    ).toThrow("numbered follower"));
  it("rejects multiple export folders", () =>
    expect(() =>
      parseEntries(
        [
          { name: "a/followers_1.json", text: "[]" },
          { name: "b/following.json", text: "[]" },
        ],
        "test",
      ),
    ).toThrow("different folders"));
  it("rejects invalid top-level schemas", () =>
    expect(() =>
      parseEntries(
        [
          { name: "followers_1.json", text: "{}" },
          { name: "following.json", text: "[]" },
        ],
        "test",
      ),
    ).toThrow("structure"));
  it("computes additions and removals without claiming reasons", () => {
    const a = parseEntries(entries([row("a"), row("b")]), "a");
    const b = parseEntries(entries([row("b"), row("c")]), "b");
    expect(compareSnapshots(a, b)).toEqual({
      added: [{ username: "c", timestamp: 1704067200 }],
      removed: [{ username: "a", timestamp: 1704067200 }],
    });
  });
  it("fills gaps in chart months and omits unknown dates", () =>
    expect(
      timeline([
        { username: "a", timestamp: 1704067200 },
        { username: "b", timestamp: 1709251200 },
        { username: "c", timestamp: null },
      ]),
    ).toEqual([
      { month: "2024-01", count: 1 },
      { month: "2024-02", count: 0 },
      { month: "2024-03", count: 1 },
    ]));
  it("exports deterministic safe CSV", () =>
    expect(csv([{ username: "a", timestamp: null }])).toBe(
      "username,profile_url,export_timestamp\r\na,https://www.instagram.com/a/,",
    ));
});
