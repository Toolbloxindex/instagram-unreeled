# Changelog

## 3.6.0

- **Changed:** the Stories grid is gone. The Stories tab now shows Instagram's own strip at the top of the page, without the feed. The grid depended on too many details of Instagram's page and sometimes failed to open a story or left a dark box over it.
- **Fixed:** a DM conversation could stay blank on iPhone. While a conversation loads, the script could mistake its container for Instagram's tab bar and hide it. Anything holding a message box or message list is now never hidden.
- **Tests:** rewritten for the strip and a DM conversation that loads in stages.

## 3.5.3

- **Fixed:** the dark box above the Stories grid, for real this time. The grid sat below Instagram's own (hidden) home page, and after a story closes Instagram rebuilds that page as a full-screen loading layout. That empty screen pushed the grid down. In grid mode Instagram's page no longer takes up any room.
- **Tests:** the mock now reproduces the full-screen loading layout, and the test checks that the grid starts at the top after closing a story and that the original strip layout still works.

## 3.5.2

- **Fixed:** tapping a story in the grid sometimes showed the original strip instead of opening the story. Instagram only keeps nearby stories loaded, so the script now scrolls its hidden strip to the story and opens it.
- **Fixed:** the dark box covering the Stories grid after closing a story. While the grid is showing, the script now hides anything Instagram leaves on top of it. It logs what it hid to the console, so the cause can be confirmed.
- **New:** automated test (`npm test`) against a local mock of Instagram's stories strip.

## 3.5.1

- **Fixed:** a large dark block could cover the Stories grid after closing a story.

## 3.5.0 (first public release)

- **Fixed:** the Account tab sometimes didn't open your profile. It now loads your profile URL directly and remembers your username across tabs, per account.
- **Fixed:** a profile page could be hidden while it was still loading.
- **Fixed:** the Account tab icon changed colour after you visited your profile.
- **New:** the Stories grid shows new and already-watched stories differently, with watched ones sorted last.
- **New:** the Reels tab on profile pages is hidden.

## 3.4.0

- Private version, before the project was published.
