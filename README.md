# Instagram Unreeled

A userscript that turns instagram.com into a distraction-free messenger.

- **Blocked:** Reels, Explore, Search and the Home feed. Reel links redirect to your messages.
- **Kept:** Direct Messages, Stories, notifications, your profile, settings and account switching.
- **Stories as a grid:** all stories on one screen instead of a sideways strip. New stories have a coloured ring; stories you've already watched are faded and moved to the end.
- **Simple bottom bar:** Messages · Account · Stories.

It works best on a phone browser, where Instagram's app would otherwise pull you into Reels.

> Not affiliated with, endorsed by, or connected to Instagram or Meta. It changes only what your own browser displays. Use it at your own risk.

## Install

**[Install the script](https://raw.githubusercontent.com/Toolbloxindex/instagram-unreeled/main/instagram-unreeled.user.js)**: open this link after you've set up a userscript manager for your platform (below).

### iPhone and iPad (Safari)

1. Install **[Userscripts](https://apps.apple.com/app/userscripts/id1463298887)** from the App Store (free and open source).
2. Open the Userscripts app once and tap **Set Userscripts Directory**. Any folder works, for example *On My iPhone › Userscripts*.
3. Go to **Settings › Apps › Safari › Extensions › Userscripts**. Turn it on and set **instagram.com** to **Allow** (or allow all websites).
4. In Safari, open the [install link](https://raw.githubusercontent.com/Toolbloxindex/instagram-unreeled/main/instagram-unreeled.user.js).
5. Tap the **aA** (or puzzle-piece) button in the address bar, choose **Userscripts**, then tap **Install**.
6. Open [instagram.com](https://www.instagram.com) and log in.

**Tip:** in Safari, tap Share › **Add to Home Screen** on instagram.com to get an "app" icon that opens the focused version. You can then delete the Instagram app.

### Mac (Safari)

Install [Userscripts for Mac](https://apps.apple.com/app/userscripts/id1463298887) and enable it in **Safari › Settings › Extensions**. Then open the install link and click **Install** in the Userscripts popup.

### Chrome, Edge, Brave and Opera (desktop)

1. Install **[Violentmonkey](https://violentmonkey.github.io/)** or **[Tampermonkey](https://www.tampermonkey.net/)**.
2. Recent Chrome versions require one extra switch: open the extension's **Details** page and turn on **Allow User Scripts**. Older versions need **Developer mode** on at `chrome://extensions`.
3. Open the install link and confirm.

### Firefox (desktop and Android)

Install **[Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/)** or **[Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/)** from Firefox Add-ons, then open the install link. On Android, Firefox is the easiest option because Chrome for Android doesn't support extensions.

### Updates

The script declares an `@updateURL`, so Violentmonkey and Tampermonkey update it automatically. In Userscripts (Safari), open the extension popup and tap **Check for updates**.

## How it works

Instagram doesn't offer an API for any of this, so the script reads the page structure (links, labels and landmarks) and hides or rearranges parts of it.

- Blocked routes (`/reels/`, `/explore/`, …) are stopped both on click and on navigation.
- Stories are read from Instagram's own story tray. Seen/unseen comes from the tray's accessibility labels ("Story by …, seen"), with the ring colour as a fallback.
- Your username comes from the same request Instagram's Edit profile page makes, so the Account tab works in new tabs.

### Privacy

- The script has no analytics and no third-party servers, and it uses no special permissions (`@grant none`).
- Its only network request goes to instagram.com itself, to find your username.
- That username is saved in your browser's `localStorage` on instagram.com.

## Limitations

- **Instagram changes its website often.** When it does, parts of the script can stop working until they're updated. Please [open an issue](https://github.com/Toolbloxindex/instagram-unreeled/issues) when that happens.
- **Supported Instagram interface languages:** English, Portuguese and Dutch. Other languages mostly work, but some buttons are found by their labels, so translations are welcome. Add them to the `labels` object.
- **It only works in a browser.** Nothing can modify the Instagram iOS/Android app.

## Contributing

Bug reports are most useful when they include:

- your platform, browser and userscript manager;
- your Instagram interface language;
- what you expected and what happened;
- if possible, the relevant HTML from the browser's developer tools (Safari: enable *Develop* menu › Web Inspector).

Pull requests are welcome. Keep the script a single dependency-free file.

To run the tests (they use a local mock of Instagram, not the real site):

```sh
npm install
npx playwright install webkit
npm test
```

## License

[MIT](LICENSE)
