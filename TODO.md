### **1. Vision board page**

a) ✅ DONE — title text feature. button in the top bar that creates a "typeable" rectangle. After enter, the text remains on the board, can be moved around, resized and doesnt have a border or background. Arrows are applicable to it.

b) ✅ DONE — color wheel color selection when creating a post-it note. No more premade color selection, one box that when clicked opens a color wheel -> user selects color X -> box turns the selected color X -> every post it NEW note created with the "new note" button will be of color X until it is changed.
in code, create an activeColor variable that keeps track of the last selected color (which is also the color of every NEW created note until another color is picked)

c) ✅ DONE — text customizations -> buttons for bold, italic, font size, font color in the top bar. If post-it note is selected -> apply effects to entire post-it. If text is selected -> apply changes onlt to selected text.
the buttons should also work on Titles, as they are selectable text

d) ✅ DONE text scaling with post it. Text can be manually set in font size, but from that point on if the post-it it is from is resized, it should scale accordingly and linearly with it. Do this by computin the distance from the right side of the text's rectangular outline to the note's right side + same for the bottom sides, and when scaling keep the ratio of those distances constant.

e) when having a note selected, pressing backspace should delete that note and every arrow connected to it

### **2. Project window**

## **3. Calendar rework**

a) LAYOUT:
displays days as columns, with the current week on open, each column having the day and month on top in DD.MM format (== daysRow).
daysRow should be thin enough to be discrete, while still having the DD.MM clear to read in a bold font, centered in the cell. It should have a thing border, separating it from the rest of the column. The current day's date should have a neon glow, while the others keep a solid finish. When on calendar, replace the side tap items from the ideally logo below with:
Events -> opens new event tab (see c.1)
Periods -> opens new period tab
Time Blocks -> switches to Time Blocks side panel (see c.2)
When the calendar side panel is active, Ideally button switches to normal one. leaving the calendar in a viewing mode. Clicking a different tab opens that tab and clicking the calendar (not just scrolling) switches back to the calendar side tab

b) COLUMNS
the columns are vertically scrollable to browse hours of the day. On page open, the first hour (top-most) displayed in the column is 05:00 (24 hour format), going till 17:00 (12 hour split at once), scrolling down to reveal the rest, keeping the same size ratio between hour rows. Each columns scroll should be independent of the rest (eg. i can view 05:00 - 17:00 on monday and next to it have 14:00 - 02:00 on tuesday)

c) EVENTS
c.1) NEW EVENT OVERLAY
when right clicking on a day's column, a "New Event" option pops up. Upon clicking it, an overlay opens where an Event can be created. Contents:
-> top left, Heading font "New event", clicking on it selects the whole text and opens type mode, where the user can then type the name of their event.
-> start and end time settings, displayed start above end
-> description (below start and end)
-> in the top right corner, on the same level an event type circle (it will be filled with the event type color)
-> recurrence setting (daily, every x (x<7) days, weekly, biweekly, monthly)

    c.2) Off-the-rack (TIME BLOCKS)

created in the Time Blocks tab, they are premade events with fixed durations, frequencies, types and description. When clicking on the :Time Blocks" icon in the side panel, it changes the side panel to a panel with "New Block" that opens a block creation overlay like the event creation overlay. below it is a scrollable column where already created blocks are stored. These can be dragged and dropped on the calendar. When above a day, they dont have global position, they click onto hour rows (half hours too).

d) DETAILS PANNEL
clicking on a date selects a date, dimming the rest, highlighting its borders and enhacing its brightness. Double clicking on a date opens a detailed overlay in the center of the screen, rectangular shape (with the w:h ratio of the screen, but smaller). The bg gets dimmer, the opened window has 90 percent opacity, and shows a row with DD.MM, and a vertically scrollable window with the events of the day and their added descriptions added below

e) PERIODS

f) RECCURENCE

### **GENERAL**

a) pressing on the Ideally icon acts as a back button between tabs and pop-ups

b) every and any pop-up/overlay should have an "x" button, small, subtle, that appears, in the top left corner of the pop up, when cursor hovers over it. It acts as a overlay closing button.
