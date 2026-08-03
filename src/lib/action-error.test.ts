import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@/generated/prisma/client";
import { displayActionError } from "@/lib/action-error-display";
import { toActionError } from "@/lib/action-error";

test("keeps short intentional domain errors", () => {
  const mapped = toActionError(
    new Error("Main Squad is locked after Championship"),
    "Save failed",
  );
  assert.equal(mapped.error, "Main Squad is locked after Championship");
  assert.equal(mapped.code, undefined);
});

test("sanitizes Prisma Unknown argument validation dumps", () => {
  const dump = [
    "Invalid `prisma.trainerProfile.update()` invocation in",
    "/app/src/app/actions/challenge.ts:2500:30",
    "",
    "  data: {",
    "    money: 74870,",
    "    ~~~~~",
    "  }",
    "",
    "Unknown argument `money`. Available options are marked with ?.",
  ].join("\n");

  const mapped = toActionError(new Error(dump), "Save import failed");
  assert.equal(
    mapped.error,
    "Something’s out of date with the database schema. Ask a GM/dev to run migrations, then retry.",
  );
  assert.equal(mapped.code, "PRISMA_VALIDATION");
  assert.equal(mapped.error.includes("Available options are marked"), false);
  assert.equal(mapped.error.includes("money"), false);
});

test("maps PrismaClientValidationError to schema hint", () => {
  const err = new Prisma.PrismaClientValidationError("Invalid `prisma.x()`", {
    clientVersion: "0.0.0",
  });
  const mapped = toActionError(err, "Update failed");
  assert.match(mapped.error, /database schema/i);
  assert.equal(mapped.code, "PRISMA_VALIDATION");
});

test("maps Prisma P2022 to migration/column hint", () => {
  const err = new Prisma.PrismaClientKnownRequestError("Column missing", {
    code: "P2022",
    clientVersion: "0.0.0",
  });
  const mapped = toActionError(err, "Update failed");
  assert.match(mapped.error, /migrations/i);
  assert.equal(mapped.code, "PRISMA_SCHEMA_MISMATCH");
});

test("unknown non-Error values use the fallback", () => {
  const mapped = toActionError({ boom: true }, "Save import failed");
  assert.equal(mapped.error, "Save import failed");
});

test("displayActionError guards long Prisma dumps in the UI", () => {
  const dump =
    "Invalid `prisma.trainerProfile.update()` invocation\n" +
    "Unknown argument `money`. Available options are marked with ?.\n" +
    "x".repeat(80);
  const shown = displayActionError(dump);
  assert.match(shown, /try again/i);
  assert.equal(shown.includes("Unknown argument"), false);
});

test("displayActionError keeps short domain messages", () => {
  assert.equal(
    displayActionError("Trainer already claimed"),
    "Trainer already claimed",
  );
});
