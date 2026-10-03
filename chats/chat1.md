# Mockup Request

_Started 2026-10-03 21:42 UTC_

---

## User

Can you give me a mock up of how this is going to look.

## Assistant

_[tool: read_file]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: copy_starter_component]_

_[tool: grep]_

_[tool: run_script]_

_[tool: grep]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

I've put together a mockup of the mobile flow in **ViralDirector Mockup.dc.html**. It's six phone screens using the PRD's example video, "Why most teens never start a business":

1. **Concept:** you type or say your idea, then pick goal, platform, length and format.
2. **Hook & beats:** you choose one of three hooks, and the screen shows a 45-second outline of the video's parts.
3. **Call sheet:** a list of 7 shots grouped by where you'll film them, with progress, optional shots marked, and directions for the next shot.
4. **Recording:** the camera view with your line on screen, framing guides, a countdown and an automatic stop.
5. **Take review:** scores for the take, one specific note, and buttons to retake or keep it anyway.
6. **Assemble & export:** a preview of the finished video, final checks before export, light edits and the export formats.

The camera feed and video playback areas are empty placeholders. I designed it mobile-first, since recording leans that way. It's styled in EdAI colours, so I'm assuming ViralDirector sits under EdAI rather than as a separate brand. That's still an open question in the PRD.

Next, I can add a desktop planning view, make the screens clickable, or try out a light theme.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I fixed the label at the top of the page that was splitting onto two lines; it now stays on one line. The page reloaded with no errors.

## User

Hey, make this as a web project not mobile.

## Assistant

_[tool: dc_write]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

I rebuilt the mockup as a clickable web app in **ViralDirector Web.dc.html**; the mobile version is still there unchanged. A checker is still reviewing the web version in the background.

- **Steps:** the bar across the top moves you through Concept, Plan, Shots, Record, Review and Export, and the buttons on each page take you to the next step.
- **Plan and Shots:** hooks can be selected, and clicking a shot in the call sheet shows its directions in a side panel.
- **Recording:** the recording page is dark, with a 9:16 webcam view in the middle, directions on the left and a teleprompter on the right.
- **Layout:** pages rearrange to fit narrower windows.

The webcam view and video previews are still empty placeholders. Recording on a laptop webcam is a different experience from a phone, so you may want a "record on your phone" option.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I fixed the two labels on the Review and Export pages ("Director suggests a retake" and "Ready to export") that were stretching across the whole column. They're now small pills like the other labels. The page reloaded with no errors.

