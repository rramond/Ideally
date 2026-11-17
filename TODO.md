### **1. Vision board page**

a) ✅ DONE — title text feature. button in the top bar that creates a "typeable" rectangle. After enter, the text remains on the board, can be moved around, resized and doesnt have a border or background. Arrows are applicable to it.

b) ✅ DONE — color wheel color selection when creating a post-it note. No more premade color selection, one box that when clicked opens a color wheel -> user selects color X -> box turns the selected color X -> every post it NEW note created with the "new note" button will be of color X until it is changed.
in code, create an activeColor variable that keeps track of the last selected color (which is also the color of every NEW created note until another color is picked)

c) ✅ DONE — text customizations -> buttons for bold, italic, font size, font color in the top bar. If post-it note is selected -> apply effects to entire post-it. If text is selected -> apply changes onlt to selected text.
the buttons should also work on Titles, as they are selectable text

d) ✅ DONE text scaling with post it. Text can be manually set in font size, but from that point on if the post-it it is from is resized, it should scale accordingly and linearly with it. Do this by computin the distance from the right side of the text's rectangular outline to the note's right side + same for the bottom sides, and when scaling keep the ratio of those distances constant.

e) ✅ DONE — when having a note selected, pressing backspace should delete that note and every arrow connected to it

### **2. Project window**

The project window simulates the entire app on a smaller scale. Its purpose is to work on isolated projects, creating timelines, making notes, adding files and structuring the workflow.

a) PROJECT TAB ENTER
a projects button should be added in the main side panel. when clicking on it opens the projectsTAB, with a cyberpunk coruption animation, where, from left to right, horizontal neon bars of various different theme shades flow in a swift swype, leaving behind the projects tab. They should have a glitchy effect and have different lengths and equal widths. EQ sound display look.

b) PROJECT TAB HOMEPAGE
in the projects tab, projects are displayed by circles, being "pulled" towards the center. the circles have a base size, and scale with the amount of content inside, up until a max decided based on the window resolution. Hovering one of the circles makes its border glow and displays its name. clicking it opens the project on a full screen. In essence it should look like the league of legens mastery chart. the circles have a water/oil droplet reaction/animation when cursor is hovering over them.
[future plan: png for circles]

c) PROJECT FULL SCREEN

d) TIMELINE

e) FILE ATTACHMENTS

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

e) ✅ DONE — PERIODS
A period is marked by a big block of a choose-able (by colorwheel) color, that marks a window of time, coloring the header of the days it covers. It is set using a startDate and an endDate, and marks all the days in the interval. when a certain day is appended to a period, it gets a label (not user side). This will be important later since im planning on adding a discord querry system.

    e.1) ✅ DONE — When creating editing -> CANCEL EVENTS button. Can be checked, and upon checking the events that exist within the period get canceled. If a recurring event is caught inside a cancelling period, it gets halted just for the duration of that period but continues on schedule from where it ends. One-time events get cancelled and thats it. (this feature is targeted heavier towards recurring events. If i have Gym and Math study recurring during a vacation period, i would want them cancelled so as to not appear when querrying about days withing the period, as well as not deleting manually, but they should continue normally after periodEndDate)

f) ✅ DONE — FEATURE: TYPE COLOR OVERRIDE
in event creation/edit pannel, on the right of the color circle where type is chosen, add another circle, empty at first, that when hovered shows override color. This makes so that an event can have a certain type to adhere to a broad category, but can also be differentiated from that type in the case where it is someting more unique.

clicking that blank circle opens a color wheel where a color needs to be chosen. implement the same "required different enough color" system from periods, but make the forbidden range a little smaller.

After choosing the overrideColor, the block will appear with a horizotal gradient between the two colors, with overrideColor on the right and typeColor on the left, to match the positions from creation page.

g) ✅ DONE — PERIOD-AWARE EVENTS
events and their repeats can be tied to a period: e.g. "repeat only during Exams" (the repeats stop when the period ends), or hide / dim events that fall outside a chosen period.

h) ✅ DONE — EVENT TYPE LIBRARY
special dedicated library for storing, creating, editing even types. Clicking on one opens it up on screen and shows, in cronological order, all event with that type appended. Event are shown in the sidebar in descending order of nr of events/time blocks appended.

Clicking on event -> the screen shows the title of the event top left with number of EVENTS/TIME BLOCKS appended to it on the same line on the right side of the screen.

editable name for changes, color circle before it for changing type color

below is a list of all events appended to it, in cronological order in the format NAME - hour - DD.MM.YY (only last 2 trailing digits for year for readability)
each event/time block will have its row colored with its color (neon glow border, round corners) and should have interactive touch => when cursor is on a certan event row it gets a big bigger.

## **4. Themes**

a) ✅ DONE — TOKEN REFACTOR (no visual change): every UI color goes through a token in src/themes/tokens.css — the accent family (accent, dim, bright, pale, tint, iris + soft / neon glows), text (ink, ink-bright, ink-soft, muted, dim, dim-2, dim-3), surfaces (bg-deep, bg, bg-side, surface-weekend, surface, surface2, hover, hover2, line, scrollbar, overlay), danger and the logo's eye / pupil. Alpha variants are color-mix()es of a token, so they follow it. The logo, the board's arrowheads and the three JS defaults (new type color, palette fallback, scene-glow fallback) read the tokens too. User colors (types, periods, stickies, scene glows) are data and stay untouched. A few near-identical greys were unified (e.g. four off-whites → ink-bright).

b) ✅ DONE — THEMES DROPDOWN (the spec above): a Themes button at the bottom of the main side panel; the dropdown falls from the top over the main area (rounded corners, thin border, shadow, the page dimmed behind it); a looping horizontal carousel of screen-shaped previews in a set order, opening with the current theme centered and bigger, "‹ THEME NAME ›" above it; arrows, the mouse wheel (up = right neighbour, down = left), ← / → and clicking a side card move it, and the centered theme is applied live; clicking outside, the × (or Esc / Back) closes it, keeping the theme. Previews are a small drawn copy of the app (sidebar, bar, a week with events) in each theme's own colors

c) ✅ DONE — themes (src/themes/themes.js, each a full token set): Ideally (the original, default), Ethereal White (warm whites and off-whites, ochre accent, soft cloud-like shadows and a pale veil behind pop-ups), Polarized Dark (VS Code Dark+ greys and blue, flat: no glows, today's date in blue), and two "???" placeholders (their "?" preview can be centered, the theme stays as it is). Remembered across reloads (ideally.theme), applied before the first paint, a 0.45 s crossfade, the favicon follows. Glows are drawn in their own --glow colors so a theme can soften or drop them; hard ring outlines stay. User colors (event types, periods, stickies) are unchanged in every theme; the Focus tab keeps light text over its dark scenes

### **GENERAL**

a) ✅ DONE — pressing on the Ideally icon acts as a back button between tabs and pop-ups

b) ✅ DONE — every and any pop-up/overlay should have an "x" button, small, subtle, that appears, in the top left corner of the pop up, when cursor hovers over it. It acts as a overlay closing button.

c) IDEALLY API — LOCAL SERVER (planned, implement later)
move the app's data out of the browser (localStorage) into a small local Node server: an "Ideally API". The app saves to and loads from it, and the planned Discord query system reads from it (e.g. the period labels in ideally.dayLabels / ideally.periodColors). Also removes the "data is tied to the browser address" problem (file:// vs localhost, different ports).

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

d) ✅ DONE — Events / Periods / Time Blocks showed a "coming soon" message until built (all three are built now)

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

s) ✅ DONE — Start / End are typed 24-hour fields ("930" → 09:30); ↑/↓ change them by 15 min (Shift: 1 h); moving the start keeps the duration; an end equal to the start blocks saving (an end _before_ the start means next day, see ao)

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

ae) ✅ DONE — periods: the name is the period's label and is never shown on the calendar; overlapping periods stack their color bands in rows, and a day in several periods gets a striped header

af) ✅ DONE — period colors must be clearly different: OKLab distance ≥ 0.10 (tunable, MIN_COLOR_DISTANCE in src/calendar/periods.js); a too-close color is rejected with a hint naming the clashing period; a new period is offered the color farthest from the existing ones (0.10 tested and confirmed to hold well)

ag) ✅ DONE — period names are unique (case-insensitive)

ah) ✅ DONE — backend indexes rebuilt on every change: ideally.dayLabels (each covered day → its periods' names) and ideally.periodColors (name, color, OKLab value)

ai) ✅ DONE — hovering a day's DD.MM or a color band shows a tag with the period color(s) and name(s)

aj) ✅ DONE — new period: drag across day headers, right-click a header → "New period from here", or the Periods panel; right-click a header / band → Edit / Delete the period; clicking a band edits it

ak) ✅ DONE — period overlay: name heading, color circle (color wheel), Start → End fields with a mini month picker (click first day, then last day; hovering previews the range; dots mark days in other periods); dates can also be typed ("1611" → 16.11) and ↑/↓ move them by a day

al) ✅ DONE — Periods side panel (its own Back step): New Period + every period with its dates and length, past ones dimmed, the current one glowing; click edits, ↗ / right-click → "Show in calendar" jumps to its week

am) ✅ DONE — the day details window lists the day's periods (click one to edit it)

an) ✅ DONE — fixed: an apostrophe in the date-header tooltip broke the calendar code in the "added Details Pannel" commit (the app wouldn't load)

ao) ✅ DONE — overnight events: an end earlier than the start means the event ends the next day (22:00–02:00); the overlay says "Ends next day, Tue 17.11"; ↑ on End rolls past 24:00; the block is drawn on both days with a flat dashed edge at midnight, its time shown as "22:00–02:00 (+1)"; the next day's details list it as "until 02:00"; typing 00:00 as the end still means midnight of the same day (24:00)

ap) ✅ DONE — hour labels show just the hour (00 … 23, no ":00"); event blocks start closer to the labels to use the freed space

aq) ✅ DONE — cancelling periods (3e.1), how it works: only events that existed before the period started cancelling are cancelled (each event remembers when it was made; a period remembers when cancelling was switched on) — events made later, during the period, stay, so a "Flight" added inside a vacation is kept. Nothing is deleted: unchecking the box, shrinking or deleting the period brings the events back. A repeating event skips the period's days and goes on after it. Overnight events count by their start day

ar) ✅ DONE — cancelled events are ghosted on the calendar (faint, dashed, struck through, no glow) with the tooltip "Cancelled by <period>"; right-click → "Keep event" takes one out of the cancelling (it then counts as made now); the event overlay notes "⊘ Cancelled by <period> on this day"; the day details window lists them last under a "Cancelled" heading

as) ✅ DONE — period overlay: "Cancel events in this period" checkbox with a live count ("cancels 4 events, 2 repeating", or "would cancel …" while unchecked), updating as the dates change; the Periods panel marks such periods with "⊘ cancels events"

at) ✅ DONE — for the queries: eventsOn(day) leaves cancelled events out; ideally.periodColors entries carry cancelEvents

au) ✅ DONE — clicking a ghost (cancelled event) inside a period washes the period's ghosts away: one big wave in the period's color, as wide as the period, rolls slowly (1.8 s) down from its date bar through the period's columns only, each ghost fading as the glowing crest reaches it; the period then keeps them hidden (hideCancelled), so the days are free for new events. Ghosts are still edited via right-click → Edit, still listed in the day details under "Cancelled", and come back with right-click on the period's band / header → "Show cancelled events" (or by switching cancelling off and on)

av) idea: a time block dropped near the end of a day still stops at 24:00 — it could wrap into the next day like a typed end time does

aw) ✅ DONE — override color (3f) is on time blocks too (a dropped block passes it to the event); the ring is a dashed "+" circle until a color is picked; the wheel opens on a color far from the type color; a short gradient bar between the two circles previews the blend; hover × on the ring, or right-click it, removes the override

ax) ✅ DONE — the override only has to differ from its own type's color (OKLab distance ≥ 0.07, MIN_OVERRIDE_DISTANCE in src/calendar/events.js); too close → red ring + hint naming the type, saving blocked (also re-checked when the type is changed)

ay) ✅ DONE — the type → override gradient shows everywhere the type color does: calendar blocks (gradient fill, type-colored left border, override-colored right border, blended glow), the day details rows and the Time Blocks list (gradient tint, type stripe on the left, override stripe on the right), the drag ghost and the drop preview

az) ✅ DONE — tied events (3g): a "During" select in the event overlay — Any time, or one of the periods with its dates (a dot in the period's color appears beside it); a tied event and its repeats only happen on the period's days, and eventsOn() leaves the rest out so the queries agree; the start day must be inside the period (hint "Fri 05.12 is outside “Exams” (12.01 – 30.01)", saving blocked); the period never cancels its own tied events, other cancelling periods still do

ba) ✅ DONE — tied events show a dot in the period's color before their time (tooltip "During <period>"); the day details rows show "· <period>"; the Periods panel lists the number of tied events and the period overlay says "3 events are tied to this period (1 repeating)"

bb) ✅ DONE — a period shrunk past a tied event's start day leaves that day as a ghost ("Outside <period>", not struck through; right-click → Untie; listed in the day details under "Outside its period") — its repeats inside the period still happen; deleting a period unties its events (toast), nothing is deleted; time blocks can't be tied — tie the dropped event instead

bc) note: the "hide / dim events outside a chosen period" half of 3g is already covered by cancelling periods (3e.1), so no separate focus mode was built

bd) ✅ DONE — Types side panel (3h, its own Back step): New Type + every type, most used first, each with its color dot and "12 events · 3 blocks"; right-click → Open / Delete type; New Type makes the type right away (a color far from the other types') and opens it with the name selected, ready to type

be) ✅ DONE — the type view replaces the week inside the calendar (Back / the logo returns): color circle (color wheel, saved live — the calendar follows) and the name (click to rename; Enter / clicking away saves, Esc reverts, 24 characters max) on the left, the count on the right; rows NAME - hour - DD.MM.YY in the event's type → override colors with a glow, growing a little under the cursor; past one-off events dimmed; repeating ones marked ↻ with their rule; time blocks last under "Time blocks" as NAME - 1h 30m - block; clicking a row opens it for editing; "delete type" at the bottom (its events fall back to the first type; the last type can't be deleted)

bf) ✅ DONE — leaving the calendar with a type open and coming back, or reloading, reopens it; deleting the open type returns to the panel; opening another type from the panel replaces the step, so Back always returns to the calendar, never to the previous type

bg) ✅ DONE — event blocks are 60% solid today and fade with distance to 14% two weeks out (FILL_NEAR / FILL_FAR in src/calendar/calendar.js), the glow fading with them; past events are ghosted (faint, dashed, no glow — like cancelled ones, but not struck through)

bh) ✅ DONE — the number of days shown is togglable, 1 to 7 at once: a "7 days" pill with − / + next to Today, or keys 1–7 while the calendar is open (not while typing or with a pop-up open); remembered across reloads. A full week stays Monday-aligned; fewer days are a window starting on the selected date, else today if in view, else the current first day. ‹ › page by the shown count, Today starts the window on today (or shows this week at 7); the title becomes "16 – 18 Nov 2026" / "Mon 16 Nov 2026"; with 4 or fewer days the headers show the full weekday name; columns share the width, each column slot keeps its own hour position

bi) ✅ DONE — the "7 days" label can be clicked and typed into (a digit 1–7 applies at once); event text grows as fewer days are shown (the --scale variables in src/styles/calendar.css): at 4–7 days the time stays above the title and the text grows only mildly (×1.09 at 4), so a 30-minute block still holds both lines; at 1–3 days time and title share one line and the text grows to ×1.32–×1.48; headers grow half as much; the 1-day view shows each event's description to the right of its title, wrapping and clipped to the block's height

#### **4. General**

a) ✅ DONE — browser Back, the mouse back button and Alt+← do the same as the Ideally logo

b) ✅ DONE — open pop-ups (color wheels) close first when going back; the calendar side panel counts as its own back step

c) ✅ DONE — reloading the page keeps the current tab

d) ✅ DONE — small "coming soon"/status message (toast) at the bottom of the screen

e) ✅ DONE — pop-ups can be stacked (event overlay → type picker → color wheel); Back and Esc close the newest one first

f) ✅ DONE — the Ideally logo stays clickable above an overlay's dim background

g) ✅ DONE — clicking the dim background around the event overlay discards it

h) ✅ DONE — right-click menus are pop-ups too (hover x, Esc, Back)
