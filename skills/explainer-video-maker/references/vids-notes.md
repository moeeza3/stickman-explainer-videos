# Google Vids interface notes

Observed in October 2026 while driving Vids in a browser pane. The interface changes often, so treat these as things to check for, not fixed facts.

## Clip generator

- The clip model offered was Omni at 720p, with a duration slider from 3 to 10 seconds.
- Aspect ratio can flip to portrait between generations. Check it every time.
- Text typed into a stale position may not land. Click the prompt box by its element reference, select all, delete, type, then read the value back.
- Scene order can shift the insertion point. A hover preview popover can sit over the scene you meant to click, so a clip may land in the wrong scene. An empty scene left behind that way can become the title card.

- A quota shortfall may not show a message. In one run the duration slider sat disabled at 3 seconds, while "Exceeds your remaining quota" existed only as a zero-size hidden node. If the slider will not move, check whether it is disabled before retrying clicks, and tell the user rather than spending what is left on clips too short for the narration.
- A hidden browser pane can freeze screenshots and block clicks on popovers, so show the pane when the interface stops responding.

## Reading the page

- Screenshots can lag behind the real page. The DOM is the source of truth for prompt text, scene count, and generation state.
- Before calling something an error, check that the element is visible and has a real size. Vids keeps hidden "Something went wrong" nodes in the page.
- A hidden pane still works, but its page may run as a background page, so timing can be unreliable.

## Timeline

- Clicking a scene thumbnail and then its video bar selects the clip. Scroll the filmstrip into position first, and repeat after a short delay if the jump does not stick.
- The mute control sits in the clip's track settings. A failed jump can leave you on the previous scene, so confirm which scene is selected before toggling.
- Transitions defaulted to 1.5 seconds and there was no option to apply one to all scenes. Each one shortens the scenes around it.

## Audio

- Narration lines are placed per scene.
- Exported audio measured about -16.6 LUFS in one test, quieter than the common -14 LUFS YouTube target.
