import { describe, expect, it } from "vitest";
import { detectLang, dictionaries, flattenKeys, translate } from "./i18n";

describe("i18n", () => {
  it("keeps English and Chinese dictionaries aligned", () => {
    const en = flattenKeys().sort();
    const zh = Object.keys(dictionaries.zh).sort();
    expect(zh).toEqual(en);
    for (const key of en) {
      expect(dictionaries.zh[key as keyof typeof dictionaries.zh].length).toBeGreaterThan(0);
    }
  });

  it("interpolates and detects Chinese locales", () => {
    expect(translate("en", "endProcessBody", { name: "chrome", pid: 4 })).toContain("chrome");
    expect(translate("zh", "nav.overview")).toBe("总览");
    expect(detectLang("zh-CN")).toBe("zh");
    expect(detectLang("en-US")).toBe("en");
  });
});
