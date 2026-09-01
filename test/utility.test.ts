import { describe, expect, it } from "vitest";
import { piecewiseUtility } from "../src/scoring/utility";
describe("piecewiseUtility", () => { const points = [{ x: 0, score: 100 }, { x: 100, score: 0 }]; it("interpolates", () => expect(piecewiseUtility(25, points)).toBe(75)); it("clamps", () => { expect(piecewiseUtility(-1, points)).toBe(100); expect(piecewiseUtility(110, points)).toBe(0); }); });
