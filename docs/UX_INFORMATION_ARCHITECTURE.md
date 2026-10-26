# UX & Information Architecture

Version: 1.0

## 1. UX objective

Let designers produce premium presentation assets without requiring
specialist image-editing or video-editing skills. The default path
should be short, with advanced controls available only when needed.

## 2. Information architecture

Primary navigation:

-   Home / Projects
-   Mockup Studio
-   Motion Studio
-   Assets (may initially be a simple project asset picker)
-   Templates
-   Settings (later)

Project structure:

-   Project
-   Scenes
-   Uploaded assets
-   Exports
-   Recording sessions (when applicable)

## 3. Main screens

### Dashboard

-   Clear primary actions: Create mockup, Create video.
-   Recent projects and exports when persistence exists.
-   Template previews with clear labels.
-   No decorative analytics or empty dashboard widgets in the
    personal-first MVP.

### Mockup Studio

-   Template selection.
-   Upload/replacement area.
-   Scene preview.
-   Quick mode controls.
-   Advanced editor entry point.
-   Export settings and output state.

### Advanced scene editor

-   Canvas/preview center.
-   Layers panel.
-   Context-sensitive properties panel.
-   Top bar for project title, undo/redo, save state, preview, export.
-   Layer controls for visibility, lock, ordering, grouping where
    supported.
-   Snap guides and selection/transform handles.
-   Reset-to-template action.

### Motion Studio

-   Prototype URL entry and compatibility check.
-   Guided recording instructions and clear recording indicator.
-   Start/stop controls.
-   Review and retake.
-   Scene/presentation style selection.
-   Render job progress and error states.
-   Export when actual video rendering is implemented.

### Asset picker

-   Thumbnail, filename, dimensions, file type.
-   Upload/replacement action.
-   Clear unsupported-file messages.
-   Avoid exposing internal storage paths.

## 4. Core flows

### Screenshot to mockup

1.  Create/open project.
2.  Select template or start from upload.
3.  Upload screenshot.
4.  Assign screenshot to a screen slot.
5.  Preview.
6.  Adjust quick controls.
7.  Optionally open advanced editor.
8.  Export.
9.  Save scene and/or reopen.

### Advanced composition

1.  Select a layer.
2.  Adjust position, scale, rotation or supported properties.
3.  Reorder layers.
4.  Undo/redo.
5.  Save.
6.  Export at target dimensions.

### Prototype to video

1.  Paste a URL.
2.  Validate supported origin and compatibility.
3.  Explain recording permissions and limitations.
4.  Start user-initiated recording.
5.  User performs journey.
6.  Stop and review.
7.  Retake or continue.
8.  Choose scene/presentation settings.
9.  Render asynchronously.
10. Download or recover from a failure.

## 5. Interaction principles

-   Preset-first; do not show every rendering parameter on first use.
-   Preview changes immediately when feasible.
-   Make selected device/layer obvious.
-   Show autosave state and export progress.
-   Disable unsupported actions rather than allowing confusing failures.
-   Use accessible contrast, focus indicators, keyboard navigation, and
    labels.
-   Provide undo/redo for destructive scene edits.
-   Confirm destructive actions where recovery is difficult.
-   Never imply a video was recorded or exported when only a workspace
    placeholder exists.

## 6. Required states

For each main workflow, design:

-   Empty state.
-   Loading state.
-   Valid/ready state.
-   Uploading/processing state.
-   Success state.
-   Invalid input state.
-   Unsupported compatibility state.
-   Recoverable error state.
-   Retry state.
-   Permission-denied state where applicable.

## 7. Responsive behavior

Optimize the editing experience for desktop browser use. Smaller screens
should still support dashboard navigation and viewing/exporting assets
where practical. Do not pretend advanced canvas editing is equally
comfortable on narrow screens; provide a clear responsive layout or
explain the limitation.

## 8. Accessibility

-   Keyboard accessible controls.
-   Visible focus.
-   Text labels for icon-only controls.
-   Appropriate contrast.
-   Do not convey status by color alone.
-   Respect reduced-motion preferences in editor UI.
-   Provide accessible names and error descriptions for uploads and
    export controls.

## 9. UX acceptance criteria

A first-time user can create a mockup without instructions, understand
the distinction between Quick and Advanced modes, recover from an
invalid upload, and determine when an export has actually completed.
