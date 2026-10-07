// Regression guard: opening, refreshing or opening "/" in a new tab must always
// show the public plans page — signed in or not. Nothing on the "/" path may
// redirect to /painel (or anywhere else) on load.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("home page never redirects", () => {
  const index = read("routes/index.tsx");
  const root = read("routes/__root.tsx");
  const router = read("router.tsx");

  it("index route has no beforeLoad/loader redirect or programmatic navigation", () => {
    expect(index).not.toMatch(/beforeLoad\s*:/);
    expect(index).not.toMatch(/\bloader\s*:/);
    expect(index).not.toMatch(/\bredirect\s*\(/);
    expect(index).not.toMatch(/useNavigate|navigate\s*\(/);
    expect(index).not.toMatch(/window\.location(\.href)?\s*=|location\.(replace|assign)\s*\(/);
  });

  it("index keeps the 'Acessar o sistema' link to /painel", () => {
    expect(index).toMatch(/<Link to="\/painel">Acessar o sistema/);
  });

  it("root layout and auth listener never navigate", () => {
    expect(root).not.toMatch(/\bredirect\s*\(/);
    expect(root).not.toMatch(/useNavigate|navigate\s*\(/);
    expect(root).not.toMatch(/["']\/painel["']/);
  });

  it("router does not preload protected routes (a preload could trigger the auth redirect)", () => {
    expect(router).not.toMatch(/defaultPreload\s*:\s*["'](intent|viewport|render)["']/);
  });
});
