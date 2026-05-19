# Visual Framing For Self-Framed Objects

## Decision

Self-framed visual objects are not wrapped in a generic glass/card container.

Examples:

- Terminal windows
- Code editors
- Browser or app windows
- Social post cards
- Phone/device mockups
- Media player cards

These objects already communicate containment. Wrapping them in `.demo-card` or another glass shell creates a double-frame that makes the scene feel arbitrary.

## Guidance

Use generic glass/card containers only when the content has no native frame and needs grouping: metric lists, badges, abstract proof blocks, short lists, and compact unframed diagrams.

For flowcharts and pipelines, choose the frame based on density. Compact diagrams can sit inside a card. Multi-node workflow diagrams should use an open canvas or a full-scene frame so the graph has room to breathe in a 9:16 composition.

## Evidence

The `auto-posttooluse-rewrite` short originally used `.demo-card` around a terminal and around a workflow graph. The terminal read as a container inside another container. The workflow graph was cramped by the glass shell. The corrected version makes the terminal the primary visual object and lays the workflow graph on an open vertical canvas.
