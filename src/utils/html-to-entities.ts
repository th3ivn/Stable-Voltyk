import type { MessageEntity } from "@grammyjs/types";

/**
 * Convert a simple HTML string to plain text + MessageEntity array.
 *
 * Supported tags:
 * - <b>text</b> → bold
 * - <i>text</i> → italic
 * - <code>text</code> → code
 * - <tg-emoji emoji-id="X">fallback</tg-emoji> → custom_emoji
 *
 * Nesting is supported (e.g. <i><b>text</b></i>).
 *
 * Offsets/lengths are in UTF-16 code units (as required by Telegram Bot API).
 */
export function htmlToEntities(html: string): { text: string; entities: MessageEntity[] } {
  const entities: MessageEntity[] = [];
  let plainText = "";

  // Stack for tracking open tags
  const stack: Array<{
    tag: string;
    utf16Offset: number;
    emojiId?: string;
  }> = [];

  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const closeIdx = html.indexOf(">", i);
      if (closeIdx === -1) {
        // Malformed — treat as text
        plainText += html[i] ?? "";
        i++;
        continue;
      }

      const tagContent = html.slice(i + 1, closeIdx);

      // Closing tag
      if (tagContent.startsWith("/")) {
        const tagName = tagContent.slice(1).toLowerCase().trim();
        // Pop matching open tag from stack
        for (let s = stack.length - 1; s >= 0; s--) {
          const entry = stack[s];
          if (entry !== undefined && entry.tag === tagName) {
            const utf16Start = entry.utf16Offset;
            const utf16End = utf16Length(plainText);
            const length = utf16End - utf16Start;

            if (length > 0) {
              const entity = createEntity(tagName, utf16Start, length, entry.emojiId);
              if (entity !== null) {
                entities.push(entity);
              }
            }
            stack.splice(s, 1);
            break;
          }
        }
        i = closeIdx + 1;
        continue;
      }

      // Self-closing or open tag
      const tagNameMatch = /^([a-z-]+)/i.exec(tagContent);
      if (tagNameMatch === null) {
        plainText += html.slice(i, closeIdx + 1);
        i = closeIdx + 1;
        continue;
      }

      const tagName = tagNameMatch[1]?.toLowerCase() ?? "";

      // <tg-emoji emoji-id="X">
      if (tagName === "tg-emoji") {
        const emojiIdMatch = /emoji-id="([^"]+)"/.exec(tagContent);
        const emojiId = emojiIdMatch?.[1];
        stack.push({
          tag: "tg-emoji",
          utf16Offset: utf16Length(plainText),
          emojiId,
        });
        i = closeIdx + 1;
        continue;
      }

      // Standard tags: b, i, code
      if (tagName === "b" || tagName === "i" || tagName === "code") {
        stack.push({
          tag: tagName,
          utf16Offset: utf16Length(plainText),
        });
        i = closeIdx + 1;
        continue;
      }

      // Unknown tag — strip it
      i = closeIdx + 1;
      continue;
    }

    // Regular character
    plainText += html[i] ?? "";
    i++;
  }

  return { text: plainText, entities };
}

function createEntity(
  tag: string,
  offset: number,
  length: number,
  emojiId?: string,
): MessageEntity | null {
  switch (tag) {
    case "b":
      return { type: "bold", offset, length };
    case "i":
      return { type: "italic", offset, length };
    case "code":
      return { type: "code", offset, length };
    case "tg-emoji":
      if (emojiId !== undefined) {
        return { type: "custom_emoji", offset, length, custom_emoji_id: emojiId };
      }
      return null;
    default:
      return null;
  }
}

/**
 * Calculate string length in UTF-16 code units.
 * In JavaScript, string.length already returns UTF-16 code unit count,
 * so this is just a semantic wrapper.
 */
export function utf16Length(str: string): number {
  return str.length;
}
