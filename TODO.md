### **1. Vision board page**

a) ✅ DONE — title text feature. button in the top bar that creates a "typeable" rectangle. After enter, the text remains on the board, can be moved around, resized and doesnt have a border or background. Arrows are applicable to it.

b) ✅ DONE — color wheel color selection when creating a post-it note. No more premade color selection, one box that when clicked opens a color wheel -> user selects color X -> box turns the selected color X -> every post it NEW note created with the "new note" button will be of color X until it is changed.
in code, create an activeColor variable that keeps track of the last selected color (which is also the color of every NEW created note until another color is picked)

c) ✅ DONE — text customizations -> buttons for bold, italic, font size, font color in the top bar. If post-it note is selected -> apply effects to entire post-it. If text is selected -> apply changes onlt to selected text.
the buttons should also work on Titles, as they are selectable text

d) text scaling with post it. Text can be manually set in font size, but from that point on if the post-it it is from is resized, it should scale accordingly and linearly with it. Do this by computin the distance from the right side of the text's rectangular outline to the note's right side + same for the bottom sides, and when scaling keep the ratio of those distances constant.

e) when having a note selected, pressing backspace should delete that note and every arrow connected to it

f)
