import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { builtHtmlFiles } from "./helpers";

test("no built page mentions the old product except the keep-awake guide", () => {
  const offenders = builtHtmlFiles().filter((file) => {
    if (file.replaceAll("\\", "/").includes("/docs/examples/keep-awake/"))
      return false;
    return /coffee-(term|cli)/i.test(readFileSync(file, "utf8"));
  });
  expect(offenders).toEqual([]);
});
