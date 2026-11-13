import {describe,expect,it} from "vitest";
import {handball360Kickoff} from "../src/handball360-kickoff.js";

describe("Handball360 published local kickoff",()=>{
  it.each([
    ["2026-11-15T11:30:00+00:00","2026-11-15","11:30"],
    ["2026-11-22T12:45:00Z","2026-11-22","12:45"],
    ["2026-11-28T17:00:00+00:00","2026-11-28","17:00"],
    ["2027-03-20T15:30:00+00:00","2027-03-20","15:30"],
    ["2026-09-05T14:00:00+00:00","2026-09-05","14:00"],
    ["2026-10-24T16:00:00Z","2026-10-24","16:00"],
    ["2026-10-25T16:00:00Z","2026-10-25","16:00"],
    ["2027-03-28T16:00:00+00:00","2027-03-28","16:00"],
    ["2027-03-29T16:00:00+02:00","2027-03-29","16:00"],
    ["2026-12-10T07:04","2026-12-10","07:04"]
  ])("keeps the source clock for %s", (raw,date,time)=>{
    expect(handball360Kickoff(raw)).toEqual({date,time});
  });
  it("accepts day-only dates without inventing kickoff",()=>{
    expect(handball360Kickoff("2026-11-22")).toEqual({date:"2026-11-22",time:""});
  });
  it.each([
    "",null,"bad","2026-02-30T12:00Z","2026-13-10T12:00Z",
    "2026-11-22T25:00Z","2026-11-22T10:60Z",
    "2026-11-22 12:30","2026-11-22T11:30:00Zjunk"
  ])("rejects malformed date or time %s",value=>{
    expect(handball360Kickoff(value)).toBeNull();
  });
});
