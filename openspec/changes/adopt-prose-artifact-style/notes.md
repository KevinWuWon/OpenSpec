# Adopt Prose Artifact Style — Implementation Notes

## Task 1: Rename and generalize block parser (2026-03-13)

[learning] The `specs-apply.ts` file had a hardcoded regex `/^###\s*Requirement:\s*(.+)\s*$/` on line 279 for validating MODIFIED block headers, separate from the shared `REQUIREMENT_HEADER_REGEX`. After updating the parser, this caused archive tests to fail with "header mismatch in content" because the new `BLOCK_HEADER_REGEX` captures `Requirement: Name` as the full name (including the prefix), but the validation regex was still stripping it. Updated to use `/^###\s+(.+)\s*$/` to match the new format.

[learning] The renamed block header construction in `specs-apply.ts` also used `### Requirement: ${to}` — had to update to `### ${to}` to match the generalized format.

[question] `parseDeltaSpec` still references `ADDED Requirements`, `MODIFIED Requirements`, etc. as section names. Left this as-is per task scope — Task 2 will generalize delta parsing to multi-section format. The `parseRemovedNames` and `parseRenamedPairs` functions now use `BLOCK_HEADER_REGEX` (matching `### Name`) instead of the old `Requirement:` prefix regex, and the renamed pair regexes were updated from `### Requirement:` to `### ` in FROM/TO patterns.
