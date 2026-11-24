Finished work is logged in [history/](history/) — one file per area (calendar, general, notes, projects, themes, vision board).

### **Open**

- **Projects 2i:** arrows between items on a project's Board, like the Vision board's Connect.
- **Projects 2j:** a combined roadmap of every project, opened from the droplets page and filterable by project (left for later).
- **Projects 2k:** show roadmap items on the calendar, for example as all-day markers in the project's color.
- **Vision board (extras 2k):** Undo after deleting a note.
- **Calendar (extras av):** a time block dropped near the end of a day still stops at 24:00. It could continue into the next day, as a typed end time already does.

### **Future plans**

- **Projects 2b:** "[future plan: png for circles]", meaning images instead of the colored droplets.
- **Themes 4c:** the two "???" theme slots are still placeholders, waiting for two more themes.

### **Notes**

- **Projects 2l:** attached files live in this browser's storage. That only goes away with the API, and Export/Import covers it until then.
- **Calendar (extras bc):** the "hide / dim events outside a period" half of 3g was already covered by cancelling periods, so it needs no work.

### **Later**

- **GENERAL: IDEALLY API — LOCAL SERVER:** move the app's data out of the browser (localStorage) into a small local Node server: an "Ideally API". The app saves to and loads from it, and the planned Discord query system reads from it (e.g. the period labels in ideally.dayLabels / ideally.periodColors). Also removes the "data is tied to the browser address" problem (file:// vs localhost, different ports).

- **GENERAL: DISCORD BOT** create a bot that has access to the data json and can answer querries based on it.
