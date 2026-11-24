# Vision board — done

### **1. Vision board page**

a) ✅ DONE — title text feature. button in the top bar that creates a "typeable" rectangle. After enter, the text remains on the board, can be moved around, resized and doesnt have a border or background. Arrows are applicable to it.

b) ✅ DONE — color wheel color selection when creating a post-it note. No more premade color selection, one box that when clicked opens a color wheel -> user selects color X -> box turns the selected color X -> every post it NEW note created with the "new note" button will be of color X until it is changed.
in code, create an activeColor variable that keeps track of the last selected color (which is also the color of every NEW created note until another color is picked)

c) ✅ DONE — text customizations -> buttons for bold, italic, font size, font color in the top bar. If post-it note is selected -> apply effects to entire post-it. If text is selected -> apply changes onlt to selected text.
the buttons should also work on Titles, as they are selectable text

d) ✅ DONE text scaling with post it. Text can be manually set in font size, but from that point on if the post-it it is from is resized, it should scale accordingly and linearly with it. Do this by computin the distance from the right side of the text's rectangular outline to the note's right side + same for the bottom sides, and when scaling keep the ratio of those distances constant.

e) ✅ DONE — when having a note selected, pressing backspace should delete that note and every arrow connected to it

### **Extras** (added along the way, not in the original spec)

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
