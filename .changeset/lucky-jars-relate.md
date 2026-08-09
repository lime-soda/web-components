---
'@lime-soda/storybook': patch
---

Build the grid story's toolbar from `ls-button` rather than bare `<button>`
elements, so the two components are shown together and the story stops carrying
a private copy of button styling. The search input keeps local styles — there is
no input component yet — but on tokens rather than the literals it had.
