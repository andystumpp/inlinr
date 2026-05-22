# Feature Specification: Markdown Viewer Opening

**Feature Branch**: `001-markdown-viewer`  
**Created**: 2026-05-19  
**Status**: Refined  
**Refined**: 2026-05-22 — Added Mermaid diagram rendering requirements and safe fallback behavior for Mermaid blocks inside the Markdown viewer.  
**Input**: User description: "Implement the feature specification based on the updated constitution. I want to build a markdown viewer for an md file in vs code as the first basic capability on which we will build upon later. Once md file is clicked, directly opened in markdown viewer window. this will also later become the editing window."

## Clarifications

### Session 2026-05-19

- Q: Which open behavior should this first version enforce for Markdown files? → A: Replace the normal editor for `.md` files so opening a Markdown file goes straight into the Inlinr viewer.
- Q: Which Markdown open triggers should use the Inlinr viewer in v1? → A: File Explorer clicks are sufficient for v1 acceptance; additional open paths may be added later.
- Q: What should the Inlinr viewer show in v1 when a Markdown file opens? → A: A fully rendered Markdown preview only.
- Q: When the Inlinr viewer cannot render a Markdown file in v1, what should happen? → A: Stay in the Inlinr viewer and show an error state only.
- Q: What surface should host the Inlinr viewer in v1? → A: Replace the current editor tab content with the Inlinr viewer.
- Q: How should Mermaid content be handled in the Markdown viewer? → A: Render Mermaid fenced blocks as diagrams in the viewer when they can be rendered locally, and fail safely in the viewer when a Mermaid block cannot be rendered.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Markdown In Viewer (Priority: P1)

A user clicks or otherwise opens a Markdown file in VS Code and sees the document open directly in the product's Markdown viewer as a fully rendered Markdown preview instead of the normal Markdown editor or a separate preview step.

**Why this priority**: This is the base user action the product needs before any later editing workflow can exist.

**Independent Test**: Can be fully tested by opening a Markdown file from the VS Code Explorer and confirming that the viewer appears immediately with the correct document content and no extra command invocation.

**Acceptance Scenarios**:

1. **Given** a workspace contains a readable Markdown file, **When** the user opens that file, **Then** the file opens in the current editor tab as the Inlinr viewer surface immediately.
2. **Given** the user opens a Markdown file from the VS Code Explorer, **When** the viewer appears, **Then** the viewer shows a rendered preview of that file and clearly identifies which file is being viewed.
3. **Given** the opened Markdown file contains Mermaid fenced code blocks, **When** the viewer renders the document, **Then** those blocks are shown as rendered diagrams inside the viewer rather than left only as raw fenced source.

---

### User Story 2 - Switch Between Markdown Files (Priority: P2)

A user moves between Markdown files during a documentation session and each selected file opens in the same viewer flow from the VS Code Explorer without falling back to a separate manual preview step.

**Why this priority**: The first capability is only useful in daily documentation work if it stays consistent as users move between Markdown files.

**Independent Test**: Can be tested by opening two different Markdown files from the VS Code Explorer in succession and confirming that each one opens in the viewer with its own content and file identity.

**Acceptance Scenarios**:

1. **Given** the user has already opened one Markdown file in the viewer, **When** they open a different Markdown file from the VS Code Explorer, **Then** the viewer updates to the newly opened file rather than leaving the old document visible.
2. **Given** multiple Markdown files exist in the workspace, **When** the user opens any one of them through the VS Code Explorer, **Then** the same direct-to-viewer behavior is applied consistently.

---

### User Story 3 - Preserve Safe Fallbacks (Priority: P3)

A user opening unsupported or unavailable content gets a clear outcome without the extension changing unrelated file-opening behavior or silently failing.

**Why this priority**: The feature needs trustworthy boundaries before later editing capabilities build on top of the same window.

**Independent Test**: Can be tested by attempting to open a non-Markdown file and a Markdown file that cannot be rendered, then confirming that the user sees a predictable in-viewer error state and no unintended file changes.

**Acceptance Scenarios**:

1. **Given** the user opens a non-Markdown file, **When** the open request is handled, **Then** the normal non-Markdown file behavior remains unchanged.
2. **Given** the user opens a Markdown file that cannot be displayed, **When** the viewer cannot render it, **Then** the user remains in the Inlinr viewer, sees a clear error state there, and the document remains unmodified.
3. **Given** the opened Markdown file contains an invalid or unsupported Mermaid block, **When** that Mermaid content cannot be rendered safely, **Then** the viewer remains open, preserves the rest of the document preview, and shows a clear in-viewer fallback for that diagram block rather than failing silently or sending content to an external service.

---

### Edge Cases

- What happens when the user opens a Markdown file that has no readable content, is extremely large, or cannot be loaded quickly enough for an immediate view?
- How does the system handle a Markdown file open request when the file path is invalid, the file is deleted during open, or rendering fails after the viewer has started opening?
- What happens when a Markdown file contains invalid Mermaid syntax, unsupported Mermaid features, or Mermaid content that cannot be rendered safely inside the viewer?

## Scope & Boundaries *(mandatory)*

- **Selection Scope**: The scope for this feature is the single Markdown document the user explicitly opens in VS Code; the entire opened document is the active rendered viewing target in the current editor tab.
- **Review Model**: This slice is read-only and preview-only. It does not create AI suggestions, expose source editing controls, or apply document edits, so no apply or reject step is required yet.
- **Context Exposure**: Document content remains inside the local VS Code viewing experience for this feature. No Markdown content is sent to external providers or services as part of opening the viewer.
- **Out of Scope**: Editing inside the viewer, source-mode viewing inside the Inlinr surface, AI-assisted rewrites, multi-file combined views, non-Markdown rendering outside supported Markdown-embedded constructs such as Mermaid fenced blocks, persisted comments or history, and background document processing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect when a user opens a Markdown file from the VS Code Explorer in v1.
- **FR-002**: The system MUST replace the normal Markdown editor open behavior for `.md` files so the selected Markdown file opens directly in the product's Markdown viewer without requiring a separate preview command.
- **FR-013**: The system MUST host the Inlinr viewer in the current editor tab rather than opening the viewer in a side-by-side column, panel, or separate window.
- **FR-003**: The system MUST display the content of the opened Markdown file as a fully rendered Markdown preview.
- **FR-003a**: The system MUST render supported Mermaid fenced code blocks as diagrams inside the Markdown viewer.
- **FR-004**: The system MUST clearly indicate which underlying Markdown file is being viewed.
- **FR-005**: The system MUST apply the same direct-to-viewer behavior consistently when the user opens another Markdown file during the same session.
- **FR-010**: The system MUST apply this direct-to-viewer routing for Markdown files opened from the VS Code Explorer in v1; support for additional open paths may be added later.
- **FR-006**: The system MUST leave the normal open behavior for non-Markdown files unchanged.
- **FR-007**: The system MUST present a clear failure state inside the Inlinr viewer when a Markdown file cannot be displayed and MUST avoid modifying the file as part of that failure.
- **FR-007a**: When a Mermaid block cannot be rendered safely, the system MUST preserve the surrounding Markdown preview and show a clear in-viewer fallback for that block instead of failing the entire viewer silently.
- **FR-008**: Users MUST be able to open Markdown files in the viewer without sending document content to any external provider or service.
- **FR-008a**: Mermaid rendering in this slice MUST remain local to the VS Code extension and viewer experience and MUST NOT depend on external provider or network calls.
- **FR-009**: The system MUST keep this capability read-only so it can serve as the safe foundation for later editing features.
- **FR-011**: The system MUST keep the v1 Inlinr viewer focused on rendered preview only and MUST NOT expose inline source editing controls in this slice.
- **FR-012**: The system MUST NOT automatically fall back to the normal Markdown editor when the Inlinr viewer fails to render a Markdown file in v1.

### Key Entities *(include if feature involves data)*

- **Markdown Document**: The user-selected `.md` file that is being opened and rendered in the viewer.
- **Mermaid Diagram Block**: A Mermaid fenced code block embedded in a Markdown document that the viewer can attempt to render as a diagram.
- **Viewer Session**: The active viewing state that shows one Markdown document as rendered preview content and keeps that visible content associated with its source file.
- **Open Request**: The user action that triggers file opening from the VS Code workspace or editor surface.
- **Supported Open Path**: A VS Code file-open action that Inlinr explicitly guarantees for this slice; in v1 this means Markdown files opened from the Explorer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 95% of Markdown file opens display the requested document in the viewer within 2 seconds of the open action.
- **SC-001a**: In acceptance testing, 95% of sampled Markdown files containing supported Mermaid blocks display those diagrams as rendered viewer content without requiring the user to leave the Inlinr viewer.
- **SC-002**: In acceptance testing, 100% of sampled non-Markdown file opens continue to use their existing open behavior.
- **SC-003**: In first-run usability testing, at least 90% of users can open and read a Markdown file in the viewer on their first attempt without being told to run a separate preview command.
- **SC-005**: In acceptance testing, 100% of sampled Markdown file opens from the VS Code Explorer route opened Markdown files to the Inlinr viewer instead of the default Markdown editor.
- **SC-008**: In acceptance testing, 100% of sampled Markdown opens in v1 replace the current editor tab content with the Inlinr viewer rather than opening a second surface.
- **SC-004**: In failure-path testing, 100% of viewer load failures present a visible error state or fallback path without changing the underlying document contents.
- **SC-006**: In acceptance testing, 100% of sampled v1 viewer opens show rendered Markdown output rather than a source-editing surface.
- **SC-007**: In failure-path testing, 100% of Markdown render failures keep the user in the Inlinr viewer and show an in-viewer error state rather than opening the normal Markdown editor.

## Assumptions

- Users are opening local or otherwise VS Code-accessible Markdown files that the extension is permitted to read for display.
- The first release of this capability focuses on rendered preview viewing and does not yet need in-view editing controls or source-mode viewing inside the Inlinr surface.
- Existing VS Code behavior for non-Markdown files remains the default and should not be redesigned by this feature.
- Explorer-triggered Markdown opens are sufficient for v1 acceptance even if other VS Code open paths are aligned later.
- Viewer render failures can be handled inside the Inlinr viewer without forcing an automatic return to the default Markdown editor.
- Supported Mermaid rendering can be performed locally within the extension and viewer trust boundary without introducing required external network access.
- Replacing the current editor tab content with the Inlinr viewer is technically feasible within VS Code's document and editor model for this slice.
- The viewer surface created here will later host editing capabilities, but those editing behaviors are not part of this specification.
