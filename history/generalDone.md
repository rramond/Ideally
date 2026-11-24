# General — done

(app-wide features that belong to no single tab)

### **GENERAL**

a) ✅ DONE — pressing on the Ideally icon acts as a back button between tabs and pop-ups

b) ✅ DONE — every and any pop-up/overlay should have an "x" button, small, subtle, that appears, in the top left corner of the pop up, when cursor hovers over it. It acts as a overlay closing button.

d) ✅ DONE — EXPORT / IMPORT DATA (to move everything to another device, until the Ideally API exists): "Export data" and "Import data" under a "Data" label in the main menu side panel (for now)
- Export downloads one file, ideally-backup-YYYY-MM-DD.json: every saved value (all the ideally.* keys — projects with their board, notes, roadmap and goals, notes, events, time blocks, types, periods, vision board, settings, theme) and every file attached to a project (from IndexedDB, as data URLs); a toast says what went in ("1 project · 1 note · 6 events · … · 1 file")
- Import picks such a file and shows a dialog: the file's name and export time, what's in it and what's on this device, then
  - Merge: adds what this device doesn't have yet (by id: projects, notes, events, time blocks, event types, periods, vision board stickies / arrows, attached files); everything already here and this device's settings / theme are kept
  - Replace (click twice to confirm): deletes this device's data and attached files and uses the file's
  then the page reloads. The period indexes (dayLabels / periodColors) are rebuilt on load, not imported
- the Data buttons don't count as tabs (the main menu's tab switching only uses the tab buttons)
- ideally-backup*.json is in .gitignore, so an export saved inside the repo isn't committed by accident (it's personal data)

### **Extras** (added along the way, not in the original spec)

#### **Project setup**

a) ✅ DONE — Node upgraded to 24 via nvm (Vite needs 20.19+)

b) ✅ DONE — EXTRAS grouped by category, in the same style as the main TODOs

c) ✅ DONE — calendar code moved into src/calendar/ (week view, events + types data, event overlay)

#### **General**

a) ✅ DONE — browser Back, the mouse back button and Alt+← do the same as the Ideally logo

b) ✅ DONE — open pop-ups (color wheels) close first when going back; the calendar side panel counts as its own back step

c) ✅ DONE — reloading the page keeps the current tab

d) ✅ DONE — small "coming soon"/status message (toast) at the bottom of the screen

e) ✅ DONE — pop-ups can be stacked (event overlay → type picker → color wheel); Back and Esc close the newest one first

f) ✅ DONE — the Ideally logo stays clickable above an overlay's dim background

g) ✅ DONE — clicking the dim background around the event overlay discards it

h) ✅ DONE — right-click menus are pop-ups too (hover x, Esc, Back)
