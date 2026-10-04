import { describe, expect, it } from "vitest";
import { parseLifeTable } from "./draft-model";

describe("parseLifeTable", () => {
  it("reads a headed spreadsheet paste", () => {
    const result = parseLifeTable("Age\tMale\tFemale\n0\t0.006\t0.005\n1\t0.0005\t0.0004\n2\t0.0003\t0.0002");
    expect(result).toEqual({ ok: true, startAge: 0, qx: { male: [0.006, 0.0005, 0.0003], female: [0.005, 0.0004, 0.0002] } });
  });

  it("treats one unlabelled column as both sexes combined", () => {
    expect(parseLifeTable("40, 0.003\n41, 0.0032")).toEqual({ ok: true, startAge: 40, qx: { all: [0.003, 0.0032] } });
  });

  it("explains gaps in ages and bad values", () => {
    expect(parseLifeTable("0 0.1\n2 0.2")).toMatchObject({ ok: false, error: expect.stringMatching(/go up by one/) });
    expect(parseLifeTable("0 0.1\n1 1.5")).toMatchObject({ ok: false, error: expect.stringMatching(/not a probability/) });
    expect(parseLifeTable("age x y\n0 0.1 0.1\n1 0.1 0.1")).toMatchObject({ ok: false, error: expect.stringMatching(/Name the columns/) });
  });
});
