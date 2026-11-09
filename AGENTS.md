# Agent guidance

The assets originate in HtmlForgeX. Preserve their bytes and published version
paths when changing CDN hosting. Build the static origin with `pipeline.json`
and the shared PowerForge Linux deployment lane.

Before adding or changing tests, read the shared
[test-audit authoring gate](skills/test-audit/SKILL.md#authoring-gate) and
[contract-focused test guidance](skills/contract-focused-tests/SKILL.md).
Resolve those paths against `CODEX_HOME`, which defaults to `~/.codex`.
