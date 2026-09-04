# ADR-0024: The changelog is a file at the root, read at build time

- **Status**: Accepted, amended 2026-10-07 on inline formatting. See Revisions.
- **Date**: 2026-09-03
- **Context**: [ADR-0023](0023-the-footer-is-one-panel.md), whose last bullet this amends · [code-style.md §9](../code-style.md#9-lit-components-and-css) · [design-spec.md §4](../design-spec.md#4-the-game-screen)

## Context

ADR-0023 gave the footer a `<pt-changelog>` dialog and held its releases as a `RELEASES` constant inside the component. That was right about the transport, which nothing here changes, and wrong about the address.

A changelog has two readers and the component served one of them. The other reads it on GitHub, in a pull request, or on the way into a release, and there it is expected at `CHANGELOG.md` in the root: it is the file every tool, every contributor, and every convention looks for. A release note written into a Lit component is written where only the app can find it, and the person writing it at the moment a version ships is editing a render function to do it.

The dialog also had one release in it and no drawing that said what a release *was*. Three bullets under a version reads as a paragraph with a heading; nothing distinguished a version worth noticing from a fix.

## Decision

**`CHANGELOG.md` at the repo root is the changelog. `client/views/changelog-parse.js` reads it into the releases the dialog draws, and the text is inlined into the bundle at build time.**

- **The file is the source, in a strict subset of Markdown.** A release is `## <major>.<minor>.<patch> - <YYYY-MM-DD>`, and a change is a `-` bullet under it. Every other line is ignored, which is what lets the file carry a title and a note about its own format for the GitHub reader without either reaching the dialog. ~~There is no inline formatting: a change is plain text in the file and plain text in the page, so nothing in the file can put markup into the DOM.~~ *(Amended: a change carries five inline spans. The rule that nothing in the file can put markup into the DOM is unchanged and is now carried by how they are rendered rather than by their absence. See Revisions.)*
- **It reaches the client as `import changelogText from '../../CHANGELOG.md?raw'`.** ADR-0023's reasoning for holding the releases in the bundle stands unchanged: a changelog is written by hand when a version ships and is the same for everybody, so a fetch would buy nothing and cost a spinner, a failure state, and a server route. Vite inlines the text; the parse runs once at import.
- **The parser never rejects a file.** An unrecognised line is skipped rather than thrown on, because the alternative in front of a player is a blank dialog. What holds the file to the format is `changelog-parse.test.js`, which parses the shipped `CHANGELOG.md` and asserts that it has releases, that each has changes, that they run newest first, and that the newest version is `APP_VERSION`. A typo fails the gate rather than the dialog.
- **The releases are drawn on a timeline**: an accent rail down the left of the list with a dot on each release. The rail is one absolutely positioned segment per release, running that release's full height, so the segments meet; the first and last stop at their dot rather than overshooting the list. The releases stack on padding rather than margin for the same reason. **A dot is `--accent`; the rail is the same colour at 30%**, so the line reads as a connection between the dots rather than as a border in its own right.
- **Dot size is derived from the version, not declared.** Patch `0` is a large dot, anything else a small one. Semver already says which a release is, so a `kind:` field in the file would be a second place to get it wrong.

## What was rejected

**Keeping `RELEASES` in the component and generating `CHANGELOG.md` from it.** It puts the file at the address the outside world expects, and it makes the component the source of a file that everything else in the ecosystem treats as writable. The first person to edit `CHANGELOG.md` directly, which is the natural thing to do, loses the edit at the next build.

**Serving the file from Express and fetching it on open.** It buys the ability to change the changelog without a rebuild, which is not a thing anybody needs: the changelog changes when a version ships, and a version shipping is a build. It costs a route, a loading state, a failure state, and a dialog that is empty for a frame.

**A Markdown library.** `marked` and its peers are 30 to 60 kB to render three bullets, and they render *everything*, which means the changelog becomes a place HTML can enter the page. The format here is two regular expressions and it is the format the file already wants to be in.

**A `type: fix` or `type: release` field in each heading.** The patch number already says it. A field that can disagree with the version beside it will eventually disagree with the version beside it.

**Dots sized by how much changed, rather than by the version.** It reads better on a mature changelog and there is no rule behind it, so every release becomes a judgement call about the size of its own dot.

## Consequences

**Good**

- The changelog is where a contributor, a release script, and GitHub all expect it, and writing one no longer means editing a component.
- The version in the dialog and the version in About cannot drift: a unit test fails when the top of the file is not `APP_VERSION`.
- The timeline gives the list a shape at a glance, and a patch release stops looking like a version.

**Bad, and accepted**

- **The client now imports a file from outside `client/`**, which is Vite's `?raw` and not plain ESM. It works in dev because the root is inside Vite's allowed filesystem list and at build because Rollup inlines it, but it is one more thing that is true only under the bundler.
- **The parser is a parser**, and a format nobody validates on the way in is a format that drifts. The test is the whole of the defence.
- **The rail's geometry is two local custom properties in the component**, `--rail-x` and `--rail-y`, which are lengths in a component file. They are this ornament's own dimensions rather than design values, in the way `.close`'s `2.25rem` already is, but the line between the two is drawn by review.
- **A single release draws a dot and no line.** That is honest and it is also the state the drawing was designed against; it earns its keep at the third release.

## Revisions

| Change | Original | Why | When |
|---|---|---|---|
| A change carries five inline spans: bold, italic, code, strikethrough, underline. They nest | Plain text only | A changelog names things: a flag, a key, a room code. Plain prose has no way to say which words are quoted, and the file is read on GitHub too, where the syntax renders whether or not the dialog honours it. Not honouring it means shipping literal asterisks to a player | 2026-10-07 |
| `<u>text</u>` is the underline syntax | n/a | Markdown has no underline, and `__text__` is bold everywhere else. Taking `__` would make the same file mean two different things in its two readers. GitHub passes a `u` element through, so the tag agrees in both | 2026-10-07 |
| `parseInline` returns spans; `<pt-changelog>` builds the elements | n/a | The rule that nothing in the file can put markup into the page is unchanged, and this is what now carries it. No HTML string is ever assembled: the parser emits data, and one switch in the component names the five elements it may become. A tag the parser does not know is text, `<script>` included | 2026-10-07 |

**What did not change.** Still no Markdown library, for the reason given above: the format is a handful of regular expressions, and a general renderer is the thing that would make the changelog a place HTML can enter the page. Links, images, headings, and lists inside a change stay unsupported.
