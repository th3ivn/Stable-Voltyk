import { describe, it, expect } from "vitest";
import {
  isValidIpOrDomain,
  sha256,
  escapeHtml,
  tgEmoji,
  formatDuration,
  sleep,
} from "../src/utils/helpers.js";

describe("isValidIpOrDomain", () => {
  it("accepts valid IPv4 addresses", () => {
    expect(isValidIpOrDomain("192.168.1.1")).toBe(true);
    expect(isValidIpOrDomain("10.0.0.1")).toBe(true);
    expect(isValidIpOrDomain("255.255.255.255")).toBe(true);
    expect(isValidIpOrDomain("0.0.0.0")).toBe(true);
  });

  it("accepts IPv4 with valid port", () => {
    expect(isValidIpOrDomain("192.168.1.1:80")).toBe(true);
    expect(isValidIpOrDomain("192.168.1.1:8080")).toBe(true);
    expect(isValidIpOrDomain("192.168.1.1:65535")).toBe(true);
  });

  it("rejects IPv4 with invalid port", () => {
    expect(isValidIpOrDomain("192.168.1.1:0")).toBe(false);
    expect(isValidIpOrDomain("192.168.1.1:65536")).toBe(false);
    expect(isValidIpOrDomain("192.168.1.1:99999")).toBe(false);
  });

  it("rejects invalid IPv4", () => {
    expect(isValidIpOrDomain("256.1.1.1")).toBe(false);
    expect(isValidIpOrDomain("1.2.3")).toBe(false);
    expect(isValidIpOrDomain("1.2.3.4.5")).toBe(false);
  });

  it("accepts valid domains", () => {
    expect(isValidIpOrDomain("myhome.ddns.net")).toBe(true);
    expect(isValidIpOrDomain("example.com")).toBe(true);
    expect(isValidIpOrDomain("sub.domain.co.ua")).toBe(true);
  });

  it("accepts domains with port", () => {
    expect(isValidIpOrDomain("myhome.ddns.net:80")).toBe(true);
    expect(isValidIpOrDomain("example.com:443")).toBe(true);
  });

  it("rejects invalid inputs", () => {
    expect(isValidIpOrDomain("")).toBe(false);
    expect(isValidIpOrDomain("   ")).toBe(false);
    expect(isValidIpOrDomain("not valid")).toBe(false);
    expect(isValidIpOrDomain("http://example.com")).toBe(false);
  });
});

describe("sha256", () => {
  it("produces consistent hash", () => {
    const hash1 = sha256("hello");
    const hash2 = sha256("hello");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", () => {
    expect(sha256("hello")).not.toBe(sha256("world"));
  });

  it("returns 64 char hex string", () => {
    const hash = sha256("test");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml("<b>test</b>")).toBe("&lt;b&gt;test&lt;/b&gt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("leaves normal text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("tgEmoji", () => {
  it("creates tg-emoji tag", () => {
    const result = tgEmoji("12345", "⚡");
    expect(result).toBe('<tg-emoji emoji-id="12345">⚡</tg-emoji>');
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1г 30хв");
  });

  it("formats hours only", () => {
    expect(formatDuration(120)).toBe("2г");
  });

  it("formats minutes only", () => {
    expect(formatDuration(45)).toBe("45хв");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0хв");
  });
});

describe("sleep", () => {
  it("resolves after delay", async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});
