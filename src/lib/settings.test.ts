import { describe, expect, it } from "vitest";
import { hiddenInterval, readQuery } from "./settings";

describe("settings helpers", () => {
  it("slows the interval only when the window is hidden", () => {
    expect(hiddenInterval(500, false, true)).toBe(500);
    expect(hiddenInterval(500, true, true)).toBe(2000);
    expect(hiddenInterval(2000, true, true)).toBe(8000);
    expect(hiddenInterval(1000, true, false)).toBe(1000);
  });

  it("reads screenshot query params", () => {
    const boot = readQuery("?page=processes&theme=light&lang=zh&shot=1&tick=40");
    expect(boot.page).toBe("processes");
    expect(boot.theme).toBe("light");
    expect(boot.lang).toBe("zh");
    expect(boot.shot).toBe(true);
    expect(boot.tick).toBe(40);
    expect(readQuery("?interval=500").intervalMs).toBe(500);
    expect(readQuery("?interval=750").intervalMs).toBeUndefined();
    expect(readQuery("?page=nope").page).toBe("overview");
  });
});
