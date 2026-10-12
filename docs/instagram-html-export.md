# Instagram HTML export integration

Development branch: `feature/instagram-html-export`

## Target workflow

- Pre-match: export one Matchday PNG without requiring a video.
- Post-match: export halftime PNG, final-score PNG and selected highlight MP4 files in a ZIP.
- Three independently uploaded HTML templates: `matchday`, `endstand` (shared between halftime and final), `highlight`.
- Imported self-contained HTML/CSS, including embedded background assets, must affect actual exported media, not only the preview.
- Preserve all documented `data-field` names and support known team logos; avoid all network-dependent assets.

## Implementation checkpoints

1. Extract template data binding and safety validation into testable functions. Never execute imported scripts or load remote CSS/assets.
2. Render filled static templates at exactly 1080 x 1350 as PNG (Matchday, halftime, final).
3. Reuse the highlight HTML layout to compose video frames, preserving the 16:9 video rectangle and audio/annotations.
4. Wire export selection, explicit missing-data errors, and zip naming without breaking the existing non-Instagram exporters.
5. Cover three-template persistence, preview/export parity, both export phases, score correctness, and mobile/desktop Playwright.

## Merge gates

- `npm run test:unit` passes.
- Playwright desktop/mobile checks pass.
- Generated PNGs match selected HTML templates; exported MP4 includes the template layout.
- No external network resources are required by imported HTML templates.
