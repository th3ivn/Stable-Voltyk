import { describe, it, expect } from "vitest";
import { htmlToEntities } from "../src/utils/html-to-entities.js";

describe("htmlToEntities", () => {
  it("converts bold tags", () => {
    const { text, entities } = htmlToEntities("Hello <b>world</b>!");
    expect(text).toBe("Hello world!");
    expect(entities).toEqual([{ type: "bold", offset: 6, length: 5 }]);
  });

  it("converts italic tags", () => {
    const { text, entities } = htmlToEntities("<i>italic text</i>");
    expect(text).toBe("italic text");
    expect(entities).toEqual([{ type: "italic", offset: 0, length: 11 }]);
  });

  it("converts code tags", () => {
    const { text, entities } = htmlToEntities("Use <code>npm install</code> to install");
    expect(text).toBe("Use npm install to install");
    expect(entities).toEqual([{ type: "code", offset: 4, length: 11 }]);
  });

  it("converts tg-emoji tags", () => {
    const { text, entities } = htmlToEntities(
      '<tg-emoji emoji-id="5870509845911702494">✅</tg-emoji> Done',
    );
    expect(text).toBe("✅ Done");
    expect(entities).toEqual([
      { type: "custom_emoji", offset: 0, length: 1, custom_emoji_id: "5870509845911702494" },
    ]);
  });

  it("handles nested tags", () => {
    const { text, entities } = htmlToEntities("<i>Hello <b>world</b></i>");
    expect(text).toBe("Hello world");
    // Bold is closed first, then italic
    expect(entities).toHaveLength(2);
    expect(entities).toContainEqual({ type: "bold", offset: 6, length: 5 });
    expect(entities).toContainEqual({ type: "italic", offset: 0, length: 11 });
  });

  it("handles multiple separate tags", () => {
    const { text, entities } = htmlToEntities("<b>one</b> and <b>two</b>");
    expect(text).toBe("one and two");
    expect(entities).toEqual([
      { type: "bold", offset: 0, length: 3 },
      { type: "bold", offset: 8, length: 3 },
    ]);
  });

  it("passes through plain text", () => {
    const { text, entities } = htmlToEntities("no tags here");
    expect(text).toBe("no tags here");
    expect(entities).toEqual([]);
  });

  it("strips unknown tags", () => {
    const { text, entities } = htmlToEntities("Hello <span>world</span>!");
    // Unknown tags are stripped, content preserved
    expect(text).toBe("Hello world!");
    expect(entities).toEqual([]);
  });

  it("handles emojis in text correctly", () => {
    const { text, entities } = htmlToEntities("🪫 <b>08:00 - 12:00</b>");
    expect(text).toBe("🪫 08:00 - 12:00");
    // 🪫 is 2 UTF-16 code units (surrogate pair), + space = offset 3
    expect(entities).toEqual([{ type: "bold", offset: 3, length: 13 }]);
  });
});
