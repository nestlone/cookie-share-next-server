import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const page = readFileSync(path.join(root, "site/privacy/index.html"), "utf8");
const chinesePage = readFileSync(path.join(root, "site/privacy/zh/index.html"), "utf8");
const home = readFileSync(path.join(root, "site/index.html"), "utf8");
const howItWorks = readFileSync(path.join(root, "site/how-it-works/index.html"), "utf8");
const security = readFileSync(path.join(root, "site/security/index.html"), "utf8");
const policy = readFileSync(path.join(root, "PRIVACY.md"), "utf8");

describe("public privacy policy", () => {
  it("is linked from the public portal", () => {
    expect(home).toContain('href="/privacy/"');
  });

  it("uses real pages rather than in-page navigation", () => {
    expect(home).toContain('href="/how-it-works/"');
    expect(home).toContain('href="/security/"');
    expect(home).not.toContain('href="#');
    expect(howItWorks).toContain("Encrypt before upload");
    expect(security).toContain("Plaintext stays client-side");
  });

  it("publishes separate English and Chinese policy pages", () => {
    expect(page).toContain('href="/privacy/zh/"');
    expect(page).not.toContain("我们如何处理您的信息");
    expect(chinesePage).toContain('href="/privacy/"');
    expect(chinesePage).not.toContain("How your information is handled");
  });

  it("includes the Limited Use and no-sale disclosures", () => {
    expect(page).toContain("Chrome Web Store User Data Policy");
    expect(page).toContain("Limited Use requirements");
    expect(chinesePage).toContain("我们不会出售个人数据");
  });

  it("keeps a reviewable policy source in the repository", () => {
    expect(policy).toContain("https://cookie.nestlone.com/privacy/");
    expect(policy).toContain("OAuth access tokens");
    expect(policy).toContain("API request-limit records");
  });
});
