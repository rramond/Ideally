### **1. Vision board page**

a) ✅ DONE — title text feature. button in the top bar that creates a "typeable" rectangle. After enter, the text remains on the board, can be moved around, resized and doesnt have a border or background. Arrows are applicable to it.

b) ✅ DONE — color wheel color selection when creating a post-it note. No more premade color selection, one box that when clicked opens a color wheel -> user selects color X -> box turns the selected color X -> every post it NEW note created with the "new note" button will be of color X until it is changed.
in code, create an activeColor variable that keeps track of the last selected color (which is also the color of every NEW created note until another color is picked)

c) ✅ DONE — text customizations -> buttons for bold, italic, font size, font color in the top bar. If post-it note is selected -> apply effects to entire post-it. If text is selected -> apply changes onlt to selected text.
the buttons should also work on Titles, as they are selectable text

d) ✅ DONE text scaling with post it. Text can be manually set in font size, but from that point on if the post-it it is from is resized, it should scale accordingly and linearly with it. Do this by computin the distance from the right side of the text's rectangular outline to the note's right side + same for the bottom sides, and when scaling keep the ratio of those distances constant.

e) ✅ DONE — when having a note selected, pressing backspace should delete that note and every arrow connected to it

### **2. Project window**

## **3. Calendar rework**

a) ✅ DONE — LAYOUT:
displays days as columns, with the current week on open, each column having the day and month on top in DD.MM format (== daysRow).
daysRow should be thin enough to be discrete, while still having the DD.MM clear to read in a bold font, centered in the cell. It should have a thing border, separating it from the rest of the column. The current day's date should have a neon glow, while the others keep a solid finish. When on calendar, replace the side tap items from the ideally logo below with:
Events -> opens new event tab (see c.1)
Periods -> opens new period tab
Time Blocks -> switches to Time Blocks side panel (see c.2)
When the calendar side panel is active, Ideally button switches to normal one. leaving the calendar in a viewing mode. Clicking a different tab opens that tab and clicking the calendar (not just scrolling) switches back to the calendar side tab

b) ✅ DONE — COLUMNS
the columns are vertically scrollable to browse hours of the day. On page open, the first hour (top-most) displayed in the column is 05:00 (24 hour format), going till 17:00 (12 hour split at once), scrolling down to reveal the rest, keeping the same size ratio between hour rows. Each columns scroll should be independent of the rest (eg. i can view 05:00 - 17:00 on monday and next to it have 14:00 - 00:00 on tuesday)

c) EVENTS
c.1) ✅ DONE — NEW EVENT OVERLAY
when right clicking on a day's column, a "New Event" option pops up. Upon clicking it, an overlay opens where an Event can be created. Contents:
-> top left, Heading font "New event", clicking on it selects the whole text and opens type mode, where the user can then type the name of their event.
-> start and end time settings, displayed start above end
-> description (below start and end)
-> in the top right corner, on the same level an event type circle (it will be filled with the event type color)
-> recurrence setting (daily, every x (x<7) days, weekly, biweekly, monthly)

    c.2) ✅ DONE — Off-the-rack (TIME BLOCKS)

created in the Time Blocks tab, they are premade events with fixed durations, frequencies, types and description. When clicking on the :Time Blocks" icon in the side panel, it changes the side panel to a panel with "New Block" that opens a block creation overlay like the event creation overlay. below it is a scrollable column where already created blocks are stored. These can be dragged and dropped on the calendar. When above a day, they dont have global position, they click onto hour rows (half hours too).

d) ✅ DONE — DETAILS PANNEL
clicking on a date selects that date, dimming the rest, highlighting its borders and enhacing its brightness. Double clicking on a date opens a detailed overlay in the center of the screen, rectangular shape (with the w:h ratio of the screen, but smaller). The bg gets dimmer, the opened window has 90 percent opacity, and shows a row with DD.MM, and a vertically scrollable window with the events of the day and their added descriptions added below

e) PERIODS

f) RECCURENCE

### **GENERAL**

a) ✅ DONE — pressing on the Ideally icon acts as a back button between tabs and pop-ups

b) ✅ DONE — every and any pop-up/overlay should have an "x" button, small, subtle, that appears, in the top left corner of the pop up, when cursor hovers over it. It acts as a overlay closing button.

### **EXTRAS** (added along the way, not in the original spec)

#### **1. Project setup**

a) ✅ DONE — Node upgraded to 24 via nvm (Vite needs 20.19+)

b) ✅ DONE — EXTRAS grouped by category, in the same style as the main TODOs

c) ✅ DONE — calendar code moved into src/calendar/ (week view, events + types data, event overlay)

#### **2. Vision board**

a) ✅ DONE — titles: Enter / Esc / clicking away saves; an empty title is removed; titles are single-line; dashed outline on hover, solid while typing

b) ✅ DONE — titles don't do the 3D hover tilt (stickies still do)

c) ✅ DONE — color wheel: brightness slider + hex field; the last picked color is remembered after a reload

d) ✅ DONE — clicking a sticky/title selects it (purple outline); clicking empty board deselects; Esc deselects

e) ✅ DONE — Ctrl+B / Ctrl+I shortcuts; Ctrl+U disabled (no underline)

f) ✅ DONE — whole-note bold/italic/size/color overrides that same style on individual words inside it

g) ✅ DONE — pasting into a note/title always pastes plain text

h) ✅ DONE — saved note text is cleaned before display (no scripts or other HTML can sneak in)

i) ✅ DONE — fixed: resize grip and × button could be unclickable because the hover tilt pushed them behind the board

j) ✅ DONE — Delete works like Backspace; a selected arrow is deleted before a selected note; keys do nothing outside the board or while typing

k) idea: Undo after deleting a note

#### **3. Calendar**

a) ✅ DONE — week navigation: ‹ › arrows and Today; title shows the month(s) of the week

b) ✅ DONE — daysRow shows a dim weekday initial above the bold DD.MM, in the logo font

c) ✅ DONE — weekend columns slightly darker

d) ✅ DONE — Events / Periods / Time Blocks show a "coming soon" message until built (only Periods left)

e) ✅ DONE — hour label in each hour row; half-hour lines

f) ✅ DONE — glowing current-time line in today's column (moves every 30 s; "today" moves at midnight)

g) ✅ DONE — each weekday column keeps its scroll position when switching weeks (while the calendar stays open); scroll positions survive window resizes

h) ✅ DONE — old events moved once into the current week as 1-hour placeholder blocks (untimed ones at 12:00); overlapping events sit side by side

i) ✅ DONE — the old month grid and its add/delete-event side panel were removed (events are read-only until c.1)

j) ✅ DONE — no scroll bars in the day columns; they scroll with the mouse wheel / trackpad only

k) ✅ DONE — the half-hour line runs across the whole cell (left edge to right edge) and is a solid, dim line instead of a dotted one

l) ✅ DONE — event blocks stretch to the right edge of the column (they still start right after the hour labels)

m) ✅ DONE — event glow lowered a little, so it no longer bleeds over the hour labels

n) ✅ DONE — columns scroll hour by hour: one wheel notch (or a trackpad swipe of the same size) moves exactly one hour, landing on the hour line

o) ✅ DONE — leaving the calendar for another tab and coming back resets every column to 05:00

p) ✅ DONE — event types are user-made (name + color): defaults Work, Personal, Health, Social; add / edit / delete them from the type circle's picker; events of a deleted type fall back to the first type

q) ✅ DONE — new events start with the last type used

r) ✅ DONE — ‹ › buttons in the event overlay move the event to the previous / next day

s) ✅ DONE — Start / End are typed 24-hour fields ("930" → 09:30); ↑/↓ change them by 15 min (Shift: 1 h); moving the start keeps the duration; an end before the start shows a hint and blocks saving

t) ✅ DONE — Create needs a name: pressing it without one makes the heading pulse; Ctrl+Enter saves from anywhere in the overlay

u) ✅ DONE — right-click a column → "New event" starting at the half hour under the cursor (1 hour long); right-click an event → Edit / Delete; clicking an event opens it for editing (Save); deleting a repeating event removes all its repeats

v) ✅ DONE — the side panel's Events button opens the overlay for today at the next full hour

w) ✅ DONE — event blocks are as tall as the event lasts, tinted with the type color (the nearness glow stays), marked ↻ when they repeat, with the description in the hover tooltip

x) ✅ DONE — repeats show in the calendar right away; a monthly event on the 29th–31st falls on the last day of shorter months

y) ✅ DONE — existing events were upgraded: end = start + 1 hour, type Personal, no repeat

z) ✅ DONE — time blocks: the block overlay is the event overlay with a Duration (h:mm) field instead of date / start / end; the Time Blocks panel is its own Back step

aa) ✅ DONE — block list: click (or Enter) edits a block, right-click → Edit / Delete; each shows its type color, duration, type and ↻ if it repeats

ab) ✅ DONE — dragging a block shows where it will land (dashed preview with its times); it always ends by 24:00; Esc or dropping outside a day cancels; a dropped block becomes a normal event (editable, keeps the block's repeat)

ac) ✅ DONE — a date is selected by clicking its DD.MM; clicking it again, Esc or changing week unselects it

ad) ✅ DONE — details window: weekday + year next to the DD.MM (glowing if today); each event shows time, type (↻ if repeating) and its full description; clicking an event opens it for editing on top, and the list updates after a save / delete; "Nothing planned" when empty

#### **4. General**

a) ✅ DONE — browser Back, the mouse back button and Alt+← do the same as the Ideally logo

b) ✅ DONE — open pop-ups (color wheels) close first when going back; the calendar side panel counts as its own back step

c) ✅ DONE — reloading the page keeps the current tab

d) ✅ DONE — small "coming soon"/status message (toast) at the bottom of the screen

e) ✅ DONE — pop-ups can be stacked (event overlay → type picker → color wheel); Back and Esc close the newest one first

f) ✅ DONE — the Ideally logo stays clickable above an overlay's dim background

g) ✅ DONE — clicking the dim background around the event overlay discards it

h) ✅ DONE — right-click menus are pop-ups too (hover x, Esc, Back)
