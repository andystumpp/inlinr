---
name: cut-next-release
description: "Use when the user says cut the next release, prepare the next release, bump the Marketplace version, create the next release PR, or tag the next release. Handles the Marketplace release workflow without mixing unrelated file updates."
---

# Cut Next Release

## When to Use

- The task is a release-only change for the VS Code Marketplace.
- The user asks to cut the next release, prepare the next release, create the next release PR, or tag the next release.
- The goal is to keep release metadata and release tags aligned.

## Files in Scope

For a normal release-only task, limit edits to:

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`

Do not change source files, product docs, architecture docs, tests, workflows, or Marketplace README content unless the user explicitly expands scope.

## Release Rules

- Treat `package.json` as the Marketplace manifest source of truth.
- The release tag must exactly match the version in `package.json`.
- The next version must be higher than both the current manifest version and the highest existing remote release tag.
- Never rewrite, move, or reuse an existing release tag.
- Never create or push the release tag before the version-bump PR is merged onto `origin/main`.

## Procedure

1. Fetch `origin` and remote tags.
2. Inspect `origin/main`, the current `package.json` version, and the highest remote release tag.
3. Choose the next patch version that is higher than both.
4. Create a fresh release branch from the latest `origin/main` unless the user asked for a specific branch.
5. Run `npm version <next-version> --no-git-tag-version` so `package.json` and `package-lock.json` stay aligned.
6. Add a `CHANGELOG.md` entry for the exact release version.
7. Validate with:
   - `npm run compile`
   - `npm test`
   - `npm run package:vsix`
8. If `npm test` is blocked by an existing harness defect, record the exact blocker and related issue, and continue only if compile and packaging still pass.
9. Commit only the release metadata changes and open a PR with explicit verification notes.
10. Stop after creating the PR unless the user also asked to finish the post-merge tagging step.

## Post-Merge Tagging

After the PR is merged:

1. Fetch `origin` and tags again.
2. Verify `origin/main` now contains the merged release version.
3. Create an annotated tag `v<version>` on the current `origin/main` commit.
4. Push the new tag to `origin`.

If `origin/main` does not contain the merged version yet, stop and wait rather than tagging an older commit.
