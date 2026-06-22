# Skill Registry — ts-rosa

Generated: 2026-06-22
Project: ts-rosa (@nuup/ts-rosa)
Stack: TypeScript, Vitest, tsup, Node ESM

## Skills Index

Skills sourced from user-level registry (`~/.claude/skills/`). No project-level skills directory found.
SDD lifecycle skills (`sdd-*`) and `_shared` are excluded per scan rules.

| Name | Trigger / Description | Scope | Path |
|------|-----------------------|-------|------|
| branch-pr | Create pull requests with issue-first checks. Trigger: creating, opening, or preparing PRs for review. | user | `~/.claude/skills/branch-pr/SKILL.md` |
| chained-pr | Split oversized changes into chained PRs. Trigger: PRs over 400 lines, stacked PRs, review slices. | user | `~/.claude/skills/chained-pr/SKILL.md` |
| cognitive-doc-design | Design docs that reduce cognitive load. Trigger: writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs. | user | `~/.claude/skills/cognitive-doc-design/SKILL.md` |
| comment-writer | Write warm, direct collaboration comments. Trigger: PR feedback, issue replies, reviews, Slack messages, or GitHub comments. | user | `~/.claude/skills/comment-writer/SKILL.md` |
| issue-creation | Create GitHub issues with issue-first checks. Trigger: creating GitHub issues, bug reports, or feature requests. | user | `~/.claude/skills/issue-creation/SKILL.md` |
| judgment-day | Blind dual review + fix + re-judge. Trigger: judgment day, dual review, adversarial review, juzgar. | user | `~/.claude/skills/judgment-day/SKILL.md` |
| skill-creator | Create LLM-first skills. Trigger: new skills, agent instructions, documenting AI usage patterns. | user | `~/.claude/skills/skill-creator/SKILL.md` |
| skill-improver | Audit and upgrade existing LLM-first skills. Trigger: improve skills, audit skills, refactor skills, skill quality. | user | `~/.claude/skills/skill-improver/SKILL.md` |
| work-unit-commits | Plan commits as reviewable work units. Trigger: implementation, commit splitting, chained PRs, keeping tests and docs with code. | user | `~/.claude/skills/work-unit-commits/SKILL.md` |

## Excluded (not relevant to this stack)

- `go-testing` — Go-specific, not applicable to TypeScript project
- `laravel-feature-testing` — Laravel/PHP-specific
- `laravel-unit-testing` — Laravel/PHP-specific
- `omarchy` — Linux desktop config, not applicable

## Relevant Skills by Context

**PR/delivery work** (when committing or opening PRs):
- `branch-pr`, `chained-pr`, `work-unit-commits`

**Documentation** (READMEs, architecture docs, guides):
- `cognitive-doc-design`

**Code review / adversarial review**:
- `judgment-day`

**GitHub issues**:
- `issue-creation`

**Skill authoring**:
- `skill-creator`, `skill-improver`
