// ==UserScript==
// @name         Instagram Unreeled
// @namespace    https://github.com/Toolbloxindex/instagram-unreeled
// @version      3.5.3
// @description  Instagram without Reels, Explore or the feed: just DMs, Stories (as a grid) and your profile.
// @author       Tomás Correia
// @license      MIT
// @homepageURL  https://github.com/Toolbloxindex/instagram-unreeled
// @supportURL   https://github.com/Toolbloxindex/instagram-unreeled/issues
// @updateURL    https://raw.githubusercontent.com/Toolbloxindex/instagram-unreeled/main/instagram-unreeled.user.js
// @downloadURL  https://raw.githubusercontent.com/Toolbloxindex/instagram-unreeled/main/instagram-unreeled.user.js
// @match        https://www.instagram.com/*
// @match        https://instagram.com/*
// @run-at       document-start
// @inject-into  auto
// @grant        none
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  if (window.top !== window.self) return;

  const inbox = '/direct/inbox/';
  const stories = '/?ig-focus=stories';
  const nativeProfilePage = '/?ig-focus=profile';
  const editProfile = '/accounts/edit/';
  const hosts = new Set(['www.instagram.com', 'instagram.com']);
  const profileKey = 'ig-focus-own-profile';
  const creationKey = 'ig-focus-create-return';
  const viewAttr = 'data-ig-focus-view';
  const chrome = 'data-ig-focus-chrome';
  const branch = 'data-ig-focus-branch';
  const keep = 'data-ig-focus-keep';
  const hiddenControl = 'data-ig-focus-hidden-control';
  const hiddenBar = 'data-ig-focus-hidden-bar';
  const storySourceAttr = 'data-ig-focus-story-source';
  const storyGridAttr = 'data-ig-focus-story-grid';
  const storyTileAttr = 'data-ig-focus-story-tile';
  const storyStateAttr = 'data-ig-focus-story-state';
  const coverAttr = 'data-ig-focus-cover';
  const profileCheckedKey = 'ig-focus-profile-checked';

  const controlSelector = 'a[href], button, [role="button"], [role="link"], [role="menuitem"], [tabindex="0"], label[for], label:has(input[type="file"])';
  const feedItems = 'article, [role="article"], [data-testid="feed-post"], [data-testid="feed-post-container"]';
  const storyTrays = [
    '[data-testid="story-tray"]', '[data-testid="stories-tray"]',
    '[data-pagelet="Stories"]', '[aria-label="Stories"]:not(a, button, nav, [role="link"], [role="button"], [role="navigation"])'
  ].join(', ');
  const storyLinks = [
    'a[href^="/stories/"]', 'a[href^="https://www.instagram.com/stories/"]',
    'a[href^="https://instagram.com/stories/"]'
  ].join(', ');
  const storyItem = 'li, [role="listitem"], [role="menuitem"]';
  const inactiveControls = [feedItems, '[hidden]', '[inert]', '[aria-hidden="true"]', 'dialog:not([open])'].join(', ');
  const overlays = [
    'dialog[open]', '[role="dialog"]', '[role="alertdialog"]', '[role="menu"]', '[aria-modal="true"]',
    '[data-testid="notifications-panel"]', '[data-testid="story-composer"]',
    '[data-testid="create-menu"]', '[data-pagelet="Notifications"]'
  ].join(', ');
  const labels = {
    removed: /^(?:home|explore|reels?|search(?: (?:and|&) explore)?|início|pesquisar|explorar|startpagina|zoeken|ontdekken)$/i,
    profile: /^(?:(?:your |my )?profile|profile picture|.+['’]s profile picture|perfil|profiel|foto de perfil(?: de .+)?|profielfoto(?: van .+)?)$/i,
    profileButton: /^(?:(?:your |my )?profile|perfil|profiel)$/i,
    editProfile: /^(?:edit profile|editar perfil|profiel bewerken)$/i,
    activity: /^(?:(?:activity|notifications?|notificaç(?:ão|ões)|meldingen)(?:\s*\(\d+\))?|[1-9]\d* (?:new )?notifications?)$/i,
    story: /^(?:add (?:a |new )?(?:story|to (?:your |my )?story)|create (?:a |new )?story|new story|adicionar (?:à tua |à sua |à |ao teu |ao |uma )?(?:história|story)|criar (?:uma )?(?:história|story)|(?:een )?verhaal (?:toevoegen|maken))$/i,
    ownStory: /^(?:your story|história de você|a tua história|sua história|o teu story|je verhaal)$/i,
    settings: /^(?:settings(?: and (?:activity|privacy))?|configurações(?: e atividade)?|definições|instellingen)$/i,
    switchAccount: /^(?:switch accounts?|mudar de conta|trocar de conta|alternar contas?|van account wisselen|account wisselen)$/i,
    more: /^(?:more(?: options)?|menu|options|mais(?: opções)?|opções|meer(?: opties)?|opties)$/i,
    nextStories: /^(?:next(?: stories| page)?|scroll (?:right|forward)|see more stories|more stories|seguinte|próxim[oa]|ver mais histórias|volgend[ea]|meer verhalen)$/i,
    storyTile: /^(?:view (?:.+['’]s )?story|.+['’]s story|story (?:by|from) .+)$/i
  };

  function urlFor(value) {
    try {
      return new URL(value, location.href);
    } catch {
      return null;
    }
  }

  function pathname(url) {
    try {
      return decodeURIComponent(url.pathname).replace(/^\/+/, '/');
    } catch {
      return url.pathname;
    }
  }

  function routeFor(value, followShim = true) {
    if (!value) return '';
    const url = urlFor(value);
    if (!url) return '';
    if (url.protocol === 'instagram:') {
      const route = url.hostname ? url.hostname + url.pathname : url.pathname.replace(/^\/+/, '');
      return /^(?:reels?|explore|search)(?:\/|$)/i.test(route) ? 'blocked' : '';
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (followShim && url.hostname === 'l.instagram.com') {
      return routeFor(url.searchParams.get('u'), false);
    }
    if (!hosts.has(url.hostname)) return '';

    const path = pathname(url);
    if (path === '/') {
      const focus = url.searchParams.get('ig-focus');
      if (focus === 'stories') return 'stories';
      if (focus === 'profile') return 'native-profile';
      return 'home';
    }
    if (/^\/direct(?:\/inbox)?\/?$/i.test(path)) return 'inbox';
    if (/^\/direct\/t\/[^/]+(?:\/|$)/i.test(path)) return 'chat';
    if (/^\/(?:stories\/create|create\/story)(?:\/|$)/i.test(path)) return 'composer';
    if (/^\/stories(?:\/|$)/i.test(path)) return 'viewer';
    if (/^\/(?:explore|search|reels?|share\/reels?|[^/]+\/reels?)(?:\/|$)/i.test(path)) return 'blocked';
    if (/^\/(?:accounts\/(?:login|signup|emailsignup|password)|challenge|checkpoint)(?:\/|$)/i.test(path)) return 'auth';
    if (/^\/accounts\/(?:activity|notifications)\/?$|^\/notifications\/?$/i.test(path)) return 'activity';
    if (/^\/(?:accounts\/(?:edit|settings|privacy(?:_and_security)?)|settings)(?:\/|$)/i.test(path)) return 'settings';
    return '';
  }

  function isCreationPage(value) {
    if (!value) return false;
    const url = urlFor(value);
    if (url?.origin !== location.origin) return false;
    return routeFor(url) === 'home' || /^\/(?:create|stories)(?:\/|$)/i.test(pathname(url));
  }

  function readCreationReturn() {
    try {
      const value = sessionStorage.getItem(creationKey);
      if (value?.startsWith('/') && urlFor(value)?.origin === location.origin) return value;
      return '';
    } catch {
      return new URL(location.href).searchParams.get('ig-focus') === 'create' ? stories : '';
    }
  }

  let creationReturn = readCreationReturn();

  function setCreationReturn(path) {
    creationReturn = path;
    try {
      if (path) sessionStorage.setItem(creationKey, path);
      else sessionStorage.removeItem(creationKey);
      return true;
    } catch {
      return false;
    }
  }

  function profilePath(href) {
    if (!href) return '';
    const url = urlFor(href);
    if (url?.origin !== location.origin || routeFor(url)) return '';
    const match = pathname(url).match(/^\/([a-z\d._]{1,30})\/?$/i);
    if (!match || /^(?:accounts|direct|about|create|developer|legal|privacy|web|your_activity)$/i.test(match[1])) return '';
    return '/' + match[1] + '/';
  }

  function readCookie(name) {
    try {
      const entry = document.cookie.split('; ').find(part => part.startsWith(name + '='));
      return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
    } catch {
      return '';
    }
  }

  // ds_user_id identifies the signed-in account, so a cached username from
  // another account is not reused after switching accounts.
  function accountId() {
    return readCookie('ds_user_id');
  }

  // The username is kept in localStorage (not sessionStorage) so the Account
  // tab works straight away in new tabs instead of guessing from the DOM.
  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey) || 'null');
      const id = accountId();
      if (saved?.path && (!id || !saved.id || saved.id === id)) return profilePath(saved.path);
    } catch {
      // Detection and the account request below can still find the profile.
    }
    return '';
  }

  let ownProfile = loadProfile();
  let profileVerified = false;
  let profileRequest = null;
  let profileChecked = false;

  function rememberProfile(path) {
    if (path === ownProfile) return;
    ownProfile = path;
    try {
      if (path) localStorage.setItem(profileKey, JSON.stringify({ path, id: accountId() }));
      else localStorage.removeItem(profileKey);
    } catch {
      // The in-memory value is enough for the current page.
    }
  }

  // Ask Instagram which account is signed in. This is the same endpoint its
  // Edit profile page uses, and it does not depend on the page layout.
  function fetchOwnProfile() {
    if (profileRequest) return profileRequest;
    profileRequest = fetch('/api/v1/accounts/current_user/?edit=true', {
      credentials: 'include',
      headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest' }
    }).then(response => response.ok ? response.json() : null)
      .then(data => {
        const username = data?.user?.username;
        return typeof username === 'string' && username ? profilePath('/' + username + '/') : '';
      })
      .catch(() => '')
      .then(path => {
        if (path) {
          profileVerified = true;
          rememberProfile(path);
          try {
            sessionStorage.setItem(profileCheckedKey, accountId() || '?');
          } catch {
            // Checking again on the next page load is harmless.
          }
          if (!redirecting) refresh();
        } else {
          profileRequest = null;
        }
        return path;
      });
    return profileRequest;
  }

  function checkProfileOnce() {
    if (profileChecked || currentView === 'auth') return;
    profileChecked = true;
    let checked = '';
    try {
      checked = sessionStorage.getItem(profileCheckedKey) || '';
    } catch {
      // Verify below.
    }
    const id = accountId();
    if (ownProfile && id && checked === id) {
      profileVerified = true;
      return;
    }
    fetchOwnProfile();
  }

  function hrefOf(control) {
    return control.getAttribute('href');
  }

  function nameOf(control) {
    const icon = control.querySelector('svg[aria-label], svg title, img[alt]');
    return (control.getAttribute('aria-label') || control.getAttribute('title') ||
      icon?.getAttribute('aria-label') || icon?.getAttribute('alt') ||
      icon?.textContent || control.textContent).trim();
  }

  function hasName(control, pattern) {
    const referenced = (control.getAttribute('aria-labelledby') || '').trim().split(/\s+/)
      .map(id => id && document.getElementById(id)?.textContent).filter(Boolean).join(' ');
    const names = [referenced, control.getAttribute('aria-label'), control.getAttribute('title'), control.textContent];
    for (const icon of control.querySelectorAll('svg[aria-label], svg title, img[alt]')) {
      names.push(icon.getAttribute('aria-label') || icon.getAttribute('alt') || icon.textContent);
    }
    return names.some(name => name && pattern.test(name.trim().replace(/\s+/g, ' ')));
  }

  function nativeControls() {
    return Array.from(document.querySelectorAll(controlSelector))
      .filter(control => !control.closest('[' + chrome + '], template'));
  }

  function homeDestination(previousURL) {
    const previous = routeFor(previousURL);
    if (previous === 'native-profile') return nativeProfilePage;
    return ['viewer', 'stories', 'composer'].includes(previous) ? stories : inbox;
  }

  function blockedDestination(previousURL) {
    const url = previousURL && urlFor(previousURL);
    return url?.origin === location.origin && routeFor(url) === 'chat' ? url.href : inbox;
  }

  const originalReplaceState = history.replaceState;
  let lastAllowedURL = document.referrer;
  let lastCheckedURL = '';
  let currentView = '';
  let redirecting = false;
  let actions;
  let accountActions;
  let bottom;
  let creationNotice;
  let revealedMenu;
  let revealedMenuOpened = false;
  let status;
  let profileLink;
  let nativeProfileButton;
  let profileFallback;
  let style;
  let storyBranches = new Set();
  let storyContent = new Set();
  let storySources = new Set();
  let storyPanel;
  let storyGrid;
  let moreStories;
  let storyLayoutButton;
  let showNativeStories = false;
  let leftViewerAt = 0;
  let lastCoverScan = 0;
  let covers = new Set();
  let pagingStories = false;
  const storyRecords = new Map();

  const icons = {
    messages: '<path d="M21 11.5a9 9 0 0 1-9 9 9.6 9.6 0 0 1-3.6-.7L3 21l1.3-4.7A9 9 0 1 1 21 11.5Z"/>',
    stories: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5" stroke-dasharray="16 4"/>',
    profile: '<circle cx="12" cy="8" r="3.4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>',
    heart: '<path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"/>',
    plus: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
    settings: '<path d="M10 3h4l.5 2.2 1.6.9 2.2-.7 2 3.5-1.6 1.5v1.9l1.6 1.5-2 3.5-2.2-.7-1.6.9L14 20h-4l-.5-2.5-1.6-.9-2.2.7-2-3.5 1.6-1.5v-1.9L3.7 8.9l2-3.5 2.2.7 1.6-.9Z"/><circle cx="12" cy="11.5" r="2.6"/>',
    switchAccount: '<path d="M3 8h17m-4-4 4 4-4 4m5 4H4m4-4-4 4 4 4"/>'
  };

  function control(tag, title, { href, icon, onClick } = {}) {
    const element = document.createElement(tag);
    if (href) element.setAttribute('href', href);
    if (tag === 'button') element.type = 'button';
    if (icon) {
      element.setAttribute('aria-label', title);
      element.innerHTML = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"' +
        ' stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + icons[icon] + '</svg>';
    }
    if (!icon) element.append(title);
    if (onClick) element.addEventListener('click', onClick);
    return element;
  }

  function setStatus(message = '') {
    if (!status) return;
    if (status.textContent !== message) status.textContent = message;
  }

  function canActivate(element) {
    return !element.matches(':disabled, [aria-disabled="true"]') &&
      !element.closest(inactiveControls);
  }

  function availableControls() {
    return nativeControls().filter(element => {
      const route = routeFor(hrefOf(element));
      return canActivate(element) && route !== 'blocked' && route !== 'home';
    });
  }

  function openNotifications() {
    setStatus();
    const controls = availableControls();
    const trigger = controls.find(element => hasName(element, labels.activity)) ||
      controls.find(element => routeFor(hrefOf(element)) === 'activity');
    if (trigger) trigger.click();
    else setStatus('Instagram’s notifications are unavailable here.');
  }

  function openSettings() {
    setStatus();
    const controls = availableControls();
    const trigger = controls.find(element => hasName(element, labels.settings));
    if (trigger) trigger.click();
    else location.assign(editProfile);
  }

  function openAccountSwitcher() {
    setStatus();
    const controls = availableControls();
    const trigger = controls.find(element => hasName(element, labels.switchAccount));
    if (trigger) {
      trigger.click();
      return;
    }
    const menu = controls.find(element => !element.closest('main, [role="main"], [role="dialog"]') &&
      hasName(element, labels.more));
    if (menu) {
      // Some versions render More's menu inside the sidebar itself.
      revealedMenu = menu.closest('[' + hiddenBar + ']');
      revealedMenuOpened = false;
      revealedMenu?.removeAttribute(hiddenBar);
      menu.click();
      setStatus('Choose Switch accounts in Instagram’s menu.');
    } else {
      setStatus('Look for Switch accounts in Instagram’s More menu. If it’s missing, try Safari’s Request Desktop Website.');
    }
  }

  function startCreation() {
    const returnTo = location.pathname + location.search + location.hash;
    // Load the actual Home document so Instagram can mount its own controls.
    redirecting = true;
    location.assign(setCreationReturn(returnTo) ? '/' : '/?ig-focus=create');
  }

  function finishCreation() {
    const destination = creationReturn || stories;
    redirecting = true;
    setCreationReturn('');
    location.replace(destination);
  }

  function hasVisibleOverlay(container) {
    return Array.from(container.querySelectorAll(overlays)).some(element =>
      !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
      element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
  }

  function updateCreationNotice() {
    if (currentView !== 'native-create' || location.pathname !== '/' || !document.body) {
      creationNotice?.remove();
      return;
    }
    if (!creationNotice) {
      creationNotice = document.createElement('aside');
      creationNotice.setAttribute(chrome, 'creation');
      const instructions = document.createElement('span');
      instructions.textContent = 'Use Instagram’s +, camera, or Your story.';
      creationNotice.append(instructions, control('button', 'Done', { onClick: finishCreation }));
    }
    if (hasVisibleOverlay(document)) creationNotice.remove();
    else if (!creationNotice.isConnected) document.body.append(creationNotice);
  }

  function goToProfile(path) {
    if (profilePath(location.href).toLowerCase() !== path.toLowerCase()) location.assign(path);
  }

  // Load the profile URL directly. Clicking Instagram's hidden nav item was
  // unreliable: synthetic clicks were sometimes ignored, and the 650 ms
  // fallback interrupted slow SPA navigations by jumping to the Home page.
  async function openProfile(event) {
    if (ownProfile && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
    event.preventDefault();
    refresh();
    let path = profileVerified ? ownProfile : '';
    if (!path) {
      profileLink?.setAttribute('aria-busy', 'true');
      path = await fetchOwnProfile() || ownProfile;
      profileLink?.removeAttribute('aria-busy');
    }
    if (redirecting) return;
    if (path) {
      goToProfile(path);
      return;
    }
    const nativePath = nativeProfileButton && profilePath(hrefOf(nativeProfileButton));
    if (nativePath) {
      goToProfile(nativePath);
    } else if (nativeProfileButton) {
      const sourceURL = location.href;
      nativeProfileButton.click();
      window.setTimeout(() => {
        if (location.href === sourceURL && !redirecting && !hasVisibleOverlay(document)) {
          location.assign(nativeProfilePage);
        }
      }, 2500);
    } else {
      location.assign(nativeProfilePage);
    }
  }

  function updateProfileFallback() {
    if (currentView !== 'native-profile' || !document.body) {
      profileFallback?.remove();
      return;
    }
    if (!profileFallback) {
      profileFallback = document.createElement('aside');
      profileFallback.setAttribute(chrome, 'creation');
      const text = document.createElement('span');
      text.textContent = 'Tap Instagram’s original profile icon.';
      profileFallback.append(text, control('a', 'Back to Messages', { href: inbox }));
    }
    if (hasVisibleOverlay(document)) profileFallback.remove();
    else if (!profileFallback.isConnected) document.body.append(profileFallback);
  }

  function buildChrome() {
    actions = document.createElement('div');
    actions.setAttribute(chrome, 'actions');
    status = document.createElement('div');
    status.setAttribute('role', 'status');
    accountActions = document.createElement('div');
    accountActions.append(
      control('button', 'Settings', { icon: 'settings', onClick: openSettings }),
      control('button', 'Switch accounts', { icon: 'switchAccount', onClick: openAccountSwitcher })
    );
    actions.append(
      control('button', 'Notifications', { icon: 'heart', onClick: openNotifications }),
      control('button', 'Create story', { icon: 'plus', onClick: startCreation }),
      accountActions,
      status
    );

    bottom = document.createElement('nav');
    bottom.setAttribute(chrome, 'bottom');
    bottom.setAttribute('aria-label', 'Instagram tabs');
    profileLink = control('a', 'Account', { href: '#', icon: 'profile', onClick: openProfile });
    bottom.append(
      control('a', 'Messages', { href: inbox, icon: 'messages' }),
      profileLink,
      control('a', 'Stories', { href: stories, icon: 'stories' })
    );
  }

  function updateChrome(view, changed) {
    const showTabs = ['inbox', 'stories', 'account', 'settings', 'activity'].includes(view);
    if (!showTabs) {
      actions?.remove();
      bottom?.remove();
      return;
    }
    if (!document.body) return;
    if (!bottom) buildChrome();
    const profileHref = ownProfile || '#';
    if (hrefOf(profileLink) !== profileHref) profileLink.setAttribute('href', profileHref);
    if (['stories', 'account', 'settings'].includes(view)) {
      if (actions.parentNode !== document.body) document.body.prepend(actions);
    } else {
      actions.remove();
    }
    if (bottom.parentNode !== document.body) document.body.append(bottom);
    if (changed) setStatus();

    for (const link of bottom.querySelectorAll('a')) {
      const active = (link === profileLink ? 'account' : routeFor(hrefOf(link))) === view;
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function syncRoute() {
    const root = document.documentElement;
    if (!root || redirecting) return;
    installStyles(root);

    let url = location.href;
    let view = routeFor(url);
    if (creationReturn) {
      if (isCreationPage(url)) view = 'native-create';
      else if (view !== 'blocked') setCreationReturn('');
    }
    const destinationFromHome = homeDestination(lastAllowedURL);
    if (view === 'home' && destinationFromHome !== inbox) {
      // Instagram's viewer and router can return to bare / or drop the query.
      Reflect.apply(originalReplaceState, history, [history.state, '', destinationFromHome]);
      url = location.href;
      view = routeFor(url);
    }
    if (view === 'home' || view === 'blocked') {
      root.setAttribute(viewAttr, view);
      redirecting = true;
      const destination = creationReturn && view === 'blocked' ?
        (isCreationPage(lastAllowedURL) ? lastAllowedURL : '/') : blockedDestination(lastAllowedURL);
      location.replace(view === 'home' ? inbox : destination);
      return;
    }

    const login = ['inbox', 'stories', 'native-create', 'native-profile'].includes(view) &&
      document.querySelector('form input[type="password"]');
    if (view === 'auth' || login) {
      view = 'auth';
      rememberProfile('');
      if (creationReturn) setCreationReturn('');
    } else if (!view && ownProfile && profilePath(url).toLowerCase() === ownProfile.toLowerCase()) {
      view = 'account';
    }

    const changed = currentView !== view || lastCheckedURL !== url;
    if (changed) {
      revealedMenu = null;
      revealedMenuOpened = false;
    }
    if (currentView === 'viewer' && view !== 'viewer') leftViewerAt = performance.now();
    currentView = view;
    lastAllowedURL = lastCheckedURL = url;
    if (root.getAttribute(viewAttr) !== view) root.setAttribute(viewAttr, view);
    updateChrome(view, changed);
    updateCreationNotice();
    updateProfileFallback();
  }

  function suppressNavigation(event) {
    if (currentView === 'auth') return;
    const path = event.composedPath();
    const link = path.find(node => node instanceof Element && node.matches('a[href], area[href], [role="link"][href]'));
    const view = link ? routeFor(hrefOf(link)) : '';
    if (nativeProfileButton && path.includes(nativeProfileButton) && view !== 'blocked') return;
    if (currentView === 'native-create' && view === 'home') return;
    const hidden = path.some(node => node instanceof Element && node.hasAttribute(hiddenControl));
    if (!hidden && view !== 'blocked' && view !== 'home') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (!hidden && view === 'home') location.assign(homeDestination(location.href));
  }

  for (const eventName of ['click', 'auxclick']) {
    window.addEventListener(eventName, suppressNavigation, true);
  }

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (state, unused, url) {
      if (url != null) {
        const view = routeFor(url);
        if (view === 'blocked' && currentView !== 'auth') return;
        if (view === 'home' && currentView !== 'native-create') {
          const destination = homeDestination(location.href);
          if (destination === inbox) {
            location.assign(inbox);
            return;
          }
          const result = Reflect.apply(original, this, [state, unused, destination]);
          syncRoute();
          return result;
        }
      }
      const result = Reflect.apply(original, this, arguments);
      syncRoute();
      return result;
    };
  }

  // Find the native profile link before hiding the original navigation. Mobile
  // variants use either a nav landmark or a plain wrapper with several tab links.
  function updateNativeNavigation(controls) {
    const navigationLandmarks = 'nav, [role="navigation"], footer, [role="contentinfo"]';
    const navigationScope = navigationLandmarks + ', header';
    const outsideContent = 'main, [role="main"], [role="dialog"], [role="menu"]';
    const tabs = [];
    const profileCandidates = [];
    const profileButtons = [];
    const avatarButtons = [];
    const removed = [];
    const nativeNavigation = ['native-create', 'native-profile'].includes(currentView);
    nativeProfileButton = undefined;
    if (revealedMenu) {
      if (hasVisibleOverlay(revealedMenu)) revealedMenuOpened = true;
      else if (revealedMenuOpened || !revealedMenu.isConnected) revealedMenu = null;
    }
    for (const element of controls) {
      if (element.closest(feedItems)) continue;
      const href = hrefOf(element);
      const route = routeFor(href);
      const name = nameOf(element);
      const profile = profilePath(href);
      const path = href && urlFor(href)?.pathname;
      const searchLanding = route === 'blocked' && path && /^\/(?:explore|search|reels?)\/?$/i.test(path);
      const context = element.closest(navigationScope) || !element.closest(outsideContent);
      if (context && !element.closest(overlays)) {
        if (route === 'inbox') tabs.push(element);
        if (profile) profileCandidates.push({ element, path: profile, named: hasName(element, labels.profile) });
        if ((!href || href === '#') && element.matches('a, button, [role="button"], [role="link"], [tabindex="0"]') &&
          canActivate(element)) {
          if (hasName(element, labels.profileButton)) profileButtons.push(element);
          else if (element.querySelector('img, canvas') && !hasName(element, labels.removed)) avatarButtons.push(element);
        }
      }
      const hideHome = !nativeNavigation && route === 'home' &&
        (!['viewer', 'composer'].includes(currentView) || /^home$/i.test(name));
      const hideLabel = !nativeNavigation && currentView !== 'settings' && context &&
        labels.removed.test(name) && route !== 'blocked';
      // The Reels tab on profile pages is already blocked; hide it too.
      const profileReels = !nativeNavigation && route === 'blocked' && element.closest('[role="tablist"]');
      if (hideHome || searchLanding || hideLabel || profileReels) {
        removed.push(element);
      }
    }

    const bars = new Set();
    let groupedProfile = '';
    const hasReplacement = ['inbox', 'stories', 'account', 'settings', 'activity', 'chat'].includes(currentView) ||
      Boolean(ownProfile && profilePath(location.href).toLowerCase() === ownProfile.toLowerCase());
    // A "bar" must never be a wrapper around page content. Profile pages can
    // render briefly without <main>/<header> while loading; the old check could
    // then pick a page-wide wrapper and hide the whole profile.
    const pageContent = 'main, [role="main"], header, article, a[href*="/p/"], ' + storyTrays;
    for (const tab of removed) {
      for (let parent = tab.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (parent.matches(outsideContent) || parent.querySelector(pageContent)) break;
        if (removed.filter(element => parent.contains(element)).length < 2) continue;
        if (coversViewport(parent)) break;
        const candidates = profileCandidates.filter(({ element }) => parent.contains(element));
        const named = candidates.find(candidate => candidate.named);
        const hasInbox = tabs.some(element => parent.contains(element));
        const uniquePaths = new Set(candidates.map(candidate => candidate.path));
        const profile = named?.path || (hasInbox && uniquePaths.size === 1 ? candidates[0].path : '');
        const avatars = avatarButtons.filter(element => parent.contains(element));
        const button = candidates.find(candidate => candidate.path === profile)?.element ||
          profileButtons.find(element => parent.contains(element)) ||
          (avatars.length === 1 && avatars[0]);
        if (!hasInbox && !profile && !button) continue;
        if (profile && !groupedProfile) groupedProfile = profile;
        if (button && !nativeProfileButton) nativeProfileButton = button;
        if (parent !== revealedMenu &&
          (hasReplacement || (profile && profilePath(location.href).toLowerCase() === profile.toLowerCase()))) {
          bars.add(parent);
        }
        break;
      }
    }

    const currentProfile = profilePath(location.href);
    const ownPage = currentProfile && controls.some(element =>
      element.closest('main, [role="main"], header') && !element.closest('nav, [role="navigation"], ' + inactiveControls) &&
      hasName(element, labels.editProfile));
    const labelledProfile = profileCandidates.find(candidate => candidate.named &&
      (candidate.element.closest(navigationLandmarks) ||
        (candidate.element.closest('header') && hasName(candidate.element, labels.profileButton))));
    const detectedProfile = groupedProfile || (ownPage ? currentProfile : labelledProfile?.path);
    // Instagram's account answer wins over guesses from the layout.
    if (detectedProfile && !profileVerified) rememberProfile(detectedProfile);
    nativeProfileButton ||= labelledProfile?.element || profileButtons.find(element => element.closest(navigationScope));
    setMarks(hiddenControl, new Set(document.querySelectorAll('[' + hiddenControl + ']')), new Set(removed));
    setMarks(hiddenBar, new Set(document.querySelectorAll('[' + hiddenBar + ']')), bars);
  }

  function coversViewport(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > innerWidth * 0.6 && rect.height > innerHeight * 0.6;
  }

  function setMarks(attribute, previous, next) {
    for (const element of previous) {
      if (!next.has(element)) element.removeAttribute(attribute);
    }
    for (const element of next) {
      if (!previous.has(element)) element.setAttribute(attribute, '');
    }
    return next;
  }

  function storySource(region, items) {
    if (region.matches(storyTrays)) return region;
    const [first, ...others] = items;
    let source = first.tile.parentElement;
    while (source && others.some(item => !source.contains(item.tile))) source = source.parentElement;
    if (!source || source === region || !region.contains(source)) return null;

    for (let wrapper = source; wrapper && wrapper !== region; wrapper = wrapper.parentElement) {
      if (/^(?:auto|scroll|overlay)$/.test(getComputedStyle(wrapper).overflowX)) {
        source = wrapper;
        break;
      }
    }
    const parent = source.parentElement;
    if (parent !== region && !parent.querySelector(feedItems + ', a[href^="/p/"], a[href^="/reel/"]') &&
      [...parent.querySelectorAll(controlSelector)].some(element => hasName(element, labels.nextStories))) {
      return parent;
    }
    return source;
  }

  function storyScrollers(source) {
    return [source, ...source.querySelectorAll('div, ul, ol, section')].filter(element =>
      element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2 &&
      /^(?:auto|scroll|overlay|hidden)$/.test(getComputedStyle(element).overflowX));
  }

  function storyPagingControl() {
    for (const source of storySources) {
      const arrows = [...source.querySelectorAll(controlSelector)].filter(element =>
        hasName(element, labels.nextStories) && !element.closest(storyItem) && element.getClientRects().length > 0);
      if (arrows.length) {
        const next = arrows.find(canActivate);
        if (next) return { next };
        continue;
      }
      const scroller = storyScrollers(source).find(element =>
        Math.abs(element.scrollLeft) < element.scrollWidth - element.clientWidth - 2);
      if (scroller) return { scroller };
    }
    return null;
  }

  function advanceStories() {
    if (pagingStories || showNativeStories || currentView !== 'stories') return;
    const paging = storyPagingControl();
    if (!paging) return;
    pagingStories = true;
    moreStories.disabled = true;
    const startingCount = storyRecords.size;
    if (paging.next) paging.next.click();
    else {
      const scroller = paging.scroller;
      const direction = getComputedStyle(scroller).direction === 'rtl' ? -1 : 1;
      scroller.scrollBy({ left: direction * Math.max(scroller.clientWidth - 48, 32), behavior: 'instant' });
    }
    window.setTimeout(() => {
      pagingStories = false;
      if (currentView !== 'stories') return;
      refresh();
      if (storyRecords.size > startingCount && !moreStories.hidden &&
        moreStories.getBoundingClientRect().top < innerHeight + 100) advanceStories();
    }, 500);
  }

  function setNativeStoryLayout(native) {
    showNativeStories = native;
    refresh();
  }

  function mountStoryPanel() {
    if (!storyPanel) {
      storyPanel = document.createElement('section');
      storyPanel.setAttribute(chrome, 'story-panel');
      storyPanel.setAttribute('aria-label', 'Stories from Instagram');
      storyGrid = document.createElement('div');
      storyGrid.setAttribute(storyGridAttr, '');
      moreStories = control('button', 'Load more stories', { onClick: advanceStories });
      storyLayoutButton = control('button', 'Use original Stories strip', {
        onClick: () => setNativeStoryLayout(!showNativeStories)
      });
      const commands = document.createElement('div');
      commands.setAttribute('data-ig-focus-story-actions', '');
      commands.append(moreStories, storyLayoutButton);
      storyPanel.append(storyGrid, commands);
      const nearEnd = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) advanceStories();
      }, { rootMargin: '100px' });
      nearEnd.observe(moreStories);
    }
    if (!storyPanel.isConnected) document.body.insertBefore(storyPanel, bottom);
  }

  // Instagram labels tray items like "Story by name, not seen" / "…, seen".
  // Usernames cannot contain commas, so only the text after the last comma
  // is checked.
  const unseenState = /^(?:not seen|unseen|new|não vist[oa]|não visualizad[oa]|nova|novo|niet bekeken|nieuw)$/i;
  const seenState = /^(?:seen|viewed|vist[oa]|visualizad[oa]|bekeken|gezien)$/i;

  function labelledSeen(item) {
    const nodes = [item.element, item.tile, ...item.tile.querySelectorAll('[aria-label]')];
    for (const node of nodes) {
      const label = node.getAttribute('aria-label');
      if (!label?.includes(',')) continue;
      const state = label.slice(label.lastIndexOf(',') + 1).trim();
      if (unseenState.test(state)) return false;
      if (seenState.test(state)) return true;
    }
    return null;
  }

  // Fallback: Instagram draws the story ring on a <canvas>. A coloured ring
  // (gradient, or green for Close Friends) means unseen; a grey one means seen.
  // The canvas is copied into a private one, so Instagram's own drawing
  // context is never touched.
  const ringCache = new WeakMap();
  let ringProbe;

  function ringSeen(tile) {
    const canvas = tile.querySelector('canvas');
    if (!canvas?.width || !canvas.height) return null;
    const cached = ringCache.get(canvas);
    const now = performance.now();
    if (cached && now - cached.time < 1500) return cached.value;
    let value = null;
    try {
      const size = 48;
      ringProbe ||= document.createElement('canvas');
      ringProbe.width = ringProbe.height = size;
      const context = ringProbe.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, size, size);
      context.drawImage(canvas, 0, 0, size, size);
      const { data } = context.getImageData(0, 0, size, size);
      let colored = 0;
      let neutral = 0;
      const center = (size - 1) / 2;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          // Only sample the outer band, where the ring is drawn.
          if (Math.hypot(x - center, y - center) < size * 0.4) continue;
          const i = (y * size + x) * 4;
          if (data[i + 3] < 100) continue;
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          if (max > 60 && (max - min) / max > 0.35) colored++;
          else neutral++;
        }
      }
      if (colored >= 8) value = false;
      else if (neutral >= 8) value = true;
    } catch {
      value = null;
    }
    ringCache.set(canvas, { time: now, value });
    return value;
  }

  function storySeen(item) {
    return labelledSeen(item) ?? ringSeen(item.tile);
  }

  function showStoryState(record) {
    const state = record.seen === true ? 'seen' : record.seen === false ? 'unseen' : 'unknown';
    if (record.card.getAttribute(storyStateAttr) !== state) record.card.setAttribute(storyStateAttr, state);
    const name = state === 'unknown' ? record.label : record.label + (state === 'seen' ? ', seen' : ', new');
    if (record.card.getAttribute('aria-label') !== name) record.card.setAttribute('aria-label', name);
  }

  function storyDetails(item) {
    const { element, tile } = item;
    const href = element.matches(storyLinks) && routeFor(hrefOf(element)) === 'viewer' ? element.href : '';
    const avatar = tile.querySelector('img');
    const image = avatar?.currentSrc || avatar?.src || '';
    const own = hasName(element, labels.ownStory) || hasName(element, labels.story);
    const storyUser = href && pathname(urlFor(href)).split('/')[2];
    const text = element.textContent.trim().replace(/\s+/g, ' ');
    const label = own ? 'Your story' : text || storyUser || nameOf(element) || avatar?.alt || 'Story';
    const key = own ? 'own' : storyUser ? 'user:' + storyUser.toLowerCase() :
      'tile:' + label.toLowerCase() + ':' + image;
    return { key, href, image, label };
  }

  function liveStoryNode(record) {
    const node = record.native;
    if (!node?.isConnected || !record.tile?.isConnected) return null;
    return storyDetails({ element: node, tile: record.tile }).key === record.key ? node : null;
  }

  const pause = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  // Instagram's strip is virtualised: only items near its scroll position
  // exist in the DOM, and it is rebuilt (scrolled back to the start) after
  // closing a story. Scroll the hidden strip until the story's item exists
  // again, then open it, instead of giving up and showing the strip.
  async function findStoryNode(record) {
    let node = liveStoryNode(record);
    if (node) return node;
    const scrollers = () => [...storySources].flatMap(storyScrollers);
    for (const scroller of scrollers()) scroller.scrollLeft = record.offset || 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      await pause(120);
      refresh();
      if ((node = liveStoryNode(record))) return node;
    }
    for (const scroller of scrollers()) scroller.scrollLeft = 0;
    for (let step = 0; step < 40; step++) {
      await pause(150);
      refresh();
      if ((node = liveStoryNode(record))) return node;
      const paging = storyPagingControl();
      if (!paging) break;
      if (paging.next) paging.next.click();
      else paging.scroller.scrollLeft += Math.max(paging.scroller.clientWidth - 48, 32);
    }
    return null;
  }

  let openingStory = false;

  async function openOriginalStory(record) {
    if (openingStory) return;
    openingStory = true;
    record.card.setAttribute('aria-busy', 'true');
    try {
      const node = await findStoryNode(record);
      if (currentView !== 'stories') return;
      if (node) {
        node.click();
        return;
      }
      // Last resort: show Instagram's own strip at the story's position.
      setNativeStoryLayout(true);
      for (const scroller of [...storySources].flatMap(storyScrollers)) scroller.scrollLeft = record.offset || 0;
      setStatus('Couldn’t open that story from the grid. Tap it in the strip.');
    } finally {
      openingStory = false;
      record.card.removeAttribute('aria-busy');
    }
  }

  function addStoryRecords(items, source) {
    const scroller = storyScrollers(source)[0];
    for (const item of items) {
      const info = storyDetails(item);
      let record = storyRecords.get(info.key);
      if (!record) {
        record = { ...info };
        storyRecords.set(info.key, record);
        const card = info.href ? control('a', '', { href: info.href }) :
          control('button', '', { onClick: () => openOriginalStory(record) });
        card.setAttribute(storyTileAttr, '');
        if (info.key === 'own') card.setAttribute('data-ig-focus-own', '');
        const avatar = document.createElement('span');
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = info.label.slice(0, 1).toUpperCase();
        const caption = document.createElement('span');
        caption.textContent = info.label;
        card.append(avatar, caption);
        record.card = card;
        record.avatar = avatar;
        storyGrid.append(card);
      }
      if (info.href && record.card.matches('a') && hrefOf(record.card) !== info.href) {
        record.card.setAttribute('href', info.href);
      }
      if (info.image && !record.avatar.querySelector('img')) {
        const picture = document.createElement('img');
        picture.src = info.image;
        picture.alt = '';
        record.avatar.replaceChildren(picture);
      }
      const seen = storySeen(item);
      if (seen !== null) record.seen = seen;
      showStoryState(record);
      record.native = item.element;
      record.tile = item.tile;
      record.scroller = scroller;
      record.offset = scroller?.scrollLeft || 0;
    }
  }


  // Instagram sometimes leaves an element drawn over the Stories grid after a
  // story is closed (a dark box at the top of the screen). Find anything that
  // is not this script's UI but paints over the visible part of the grid and
  // make it transparent. Real menus and panels stay visible: an element is
  // only hidden when it has no text or buttons, or when it appeared right
  // after leaving the story viewer.
  function describe(element) {
    const rect = element.getBoundingClientRect();
    return element.tagName.toLowerCase() +
      (element.getAttribute('role') ? '[role=' + element.getAttribute('role') + ']' : '') +
      (element.getAttribute('aria-label') ? '[aria-label="' + element.getAttribute('aria-label') + '"]' : '') +
      ' ' + getComputedStyle(element).position + ' ' +
      Math.round(rect.left) + ',' + Math.round(rect.top) + ' ' + Math.round(rect.width) + 'x' + Math.round(rect.height);
  }

  function paints(element, style) {
    if (/^(?:img|video|canvas|svg|picture)$/i.test(element.tagName)) return true;
    const background = style.backgroundColor;
    return (background && background !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(background)) ||
      style.backgroundImage !== 'none';
  }

  function hasContent(element) {
    if (element.innerText?.trim()) return true;
    return [...element.querySelectorAll(controlSelector)].some(control =>
      control.getClientRects().length > 0 && canActivate(control));
  }

  function findCovers() {
    const next = new Set();
    if (currentView !== 'stories' || showNativeStories || !storyPanel?.isConnected || !storyGrid || storyGrid.hidden) return next;
    const area = storyGrid.getBoundingClientRect();
    const top = Math.max(area.top, 0);
    const bottom = Math.min(area.bottom, innerHeight);
    if (bottom - top < 20) return next;
    const justLeftViewer = performance.now() - leftViewerAt < 6000;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(element) {
        if (element.hasAttribute(chrome) || element.matches('script, style, template, link, meta')) return NodeFilter.FILTER_REJECT;
        const style = getComputedStyle(element);
        if (style.display === 'none') return NodeFilter.FILTER_REJECT;
        // Already hidden by this script (its opacity is ours): keep it hidden.
        if (element.hasAttribute(coverAttr)) {
          next.add(element);
          return NodeFilter.FILTER_REJECT;
        }
        if (style.opacity === '0') return NodeFilter.FILTER_REJECT;
        if (style.visibility === 'hidden' || element.contains(storyPanel)) return NodeFilter.FILTER_SKIP;
        const rect = element.getBoundingClientRect();
        const overlap = Math.min(rect.bottom, bottom) - Math.max(rect.top, top);
        const width = Math.min(rect.right, area.right) - Math.max(rect.left, area.left);
        if (overlap < 40 || width < area.width * 0.3 || !paints(element, style)) return NodeFilter.FILTER_SKIP;
        // Keep the outermost painting element whose subtree holds nothing of
        // ours. Story sources stay laid out (only made transparent).
        let cover = element;
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          if (parent.contains(storyPanel) || parent.hasAttribute(branch) || parent.hasAttribute(keep) && !parent.matches(overlays)) break;
          cover = parent;
        }
        if (!justLeftViewer && hasContent(cover)) return NodeFilter.FILTER_SKIP;
        next.add(cover);
        return NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) {
      // acceptNode does the work.
    }
    return next;
  }

  function updateCovers(force = false) {
    const now = performance.now();
    if (!force && now - lastCoverScan < 400) return;
    lastCoverScan = now;
    const next = findCovers();
    for (const element of next) {
      if (!covers.has(element)) console.info('[Instagram Unreeled] hid an element covering the Stories grid:', describe(element));
    }
    covers = setMarks(coverAttr, covers, next);
  }

  function isolateStories(controls) {
    const content = new Set();
    const branches = new Set();
    const sources = new Map();

    if (currentView === 'stories' && document.body) {
      const regions = new Map();
      for (const tray of document.querySelectorAll(storyTrays)) {
        if (!tray.closest(feedItems)) content.add(tray);
      }
      for (const overlay of document.querySelectorAll(overlays)) {
        // Closed viewers and menus can stay in the DOM; only keep live ones.
        if (overlay.closest(feedItems + ', [hidden], [inert], [aria-hidden="true"]')) continue;
        content.add(overlay);
      }
      for (const element of controls) {
        if (element.closest(feedItems + ', [hidden], [inert]')) continue;
        const tray = element.closest(storyTrays);
        if (!tray && element.closest(overlays)) continue;
        if (hasName(element, labels.nextStories)) continue;
        const item = element.closest(storyItem);
        const linkedStory = element.matches(storyLinks) && routeFor(hrefOf(element)) === 'viewer';
        const labelledStory = hasName(element, labels.storyTile) ||
          hasName(element, labels.ownStory) || hasName(element, labels.story);
        const nativeAvatar = tray && element.querySelector('img, canvas');
        if (!linkedStory && !labelledStory && !nativeAvatar) continue;

        const region = tray || element.closest('main, [role="main"]') || document.body;
        const tile = item && region.contains(item) ? item : element;
        if (!regions.has(region)) regions.set(region, new Map());
        const items = regions.get(region);
        if (linkedStory || !items.has(tile)) items.set(tile, { tile, element });
      }
      for (const [region, candidates] of regions) {
        const items = [...candidates.values()].filter(({ tile }) => {
          for (let parent = tile.parentElement; parent && region.contains(parent); parent = parent.parentElement) {
            if (candidates.has(parent)) return false;
          }
          return tile !== region;
        });
        if (!items.length) continue;
        const source = storySource(region, items);
        if (source) {
          content.add(source);
          sources.set(source, items);
        } else {
          for (const { tile } of items) content.add(tile);
        }
      }
      for (const element of content) {
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          branches.add(parent);
        }
      }
    }

    storyContent = setMarks(keep, storyContent, content);
    storyBranches = setMarks(branch, storyBranches, branches);
    storySources = setMarks(storySourceAttr, storySources, new Set(sources.keys()));
    const showPanel = currentView === 'stories' && (sources.size || storyRecords.size);
    if (!showPanel) {
      storyPanel?.remove();
      if (!['stories', 'viewer'].includes(currentView)) {
        showNativeStories = false;
        storyRecords.clear();
        storyGrid?.replaceChildren();
      }
      return;
    }
    mountStoryPanel();
    for (const [source, items] of sources) {
      const mode = showNativeStories ? 'visible' : 'background';
      if (source.getAttribute(storySourceAttr) !== mode) source.setAttribute(storySourceAttr, mode);
      addStoryRecords(items, source);
    }
    const hidePaging = showNativeStories || !storyPagingControl();
    if (storyGrid.hidden !== showNativeStories) storyGrid.hidden = showNativeStories;
    if (moreStories.hidden !== hidePaging) moreStories.hidden = hidePaging;
    if (moreStories.disabled !== pagingStories) moreStories.disabled = pagingStories;
    const layoutText = showNativeStories ? 'Show Stories grid' : 'Use original Stories strip';
    if (storyLayoutButton.textContent !== layoutText) storyLayoutButton.textContent = layoutText;
  }

  function installStyles(root) {
    if (!style) {
      style = document.createElement('style');
      // Each ancestor of a native Stories surface keeps its layout. Its other
      // children are hidden by default, including new feed nodes before paint.
      style.textContent = `
        html:is([${viewAttr}="home"], [${viewAttr}="blocked"]) body { visibility: hidden !important; }
        html:not([${viewAttr}="auth"]) :is([${hiddenControl}], [${hiddenBar}]),
        html[${viewAttr}="chat"] :is(${storyTrays}),
        html[${viewAttr}="native-profile"] :is(${feedItems}),
        html[${viewAttr}="stories"] :is(body, [${branch}]:not([${keep}])) >
          :not([${branch}], [${keep}], [${chrome}]),
        html[${viewAttr}="stories"] :is(${feedItems}):not([${branch}], [${keep}]),
        html[${viewAttr}="stories"] :is([role="progressbar"], progress, [data-testid="feed-loading"]):not(:is(${overlays}) *) {
          display: none !important;
        }

        /* The native strip stays laid out so the grid can read and page it,
           but nothing inside it may paint or take taps. visibility: hidden
           alone can be undone by any descendant with visibility: visible,
           which showed up as a large dark box over the grid after closing a
           story. Opacity and z-index apply to the whole subtree. */
        html[${viewAttr}="stories"] [${storySourceAttr}="background"] {
          position: fixed !important;
          inset: 0 0 auto !important;
          z-index: -1 !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        html[${viewAttr}="stories"] [${storySourceAttr}="background"] * {
          pointer-events: none !important;
        }
        /* Instagram's page stays mounted so the strip keeps working, but it
           must not take up room. After a story closes, Instagram re-renders
           home in a full-screen loading layout; left in the flow, that empty
           screen sat above the grid as a dark box. Grid layout only: the
           original strip layout shows Instagram's page as it is. */
        html[${viewAttr}="stories"] body:has(> [${chrome}="story-panel"] > [${storyGridAttr}]:not([hidden])) > [${branch}]:not([${keep}]) {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 0 !important;
          min-height: 0 !important;
          overflow: visible !important;
          z-index: -1 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        [${storyGridAttr}] {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 76px), 1fr));
          gap: 14px 8px;
          padding: 12px max(12px, env(safe-area-inset-right, 0px)) 12px max(12px, env(safe-area-inset-left, 0px));
        }
        [${storyTileAttr}] {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          min-width: 0;
          padding: 4px 0;
          border: 0;
          color: inherit;
          background: transparent;
          font: inherit;
          font-size: 12px;
          text-decoration: none;
          cursor: pointer;
        }
        [${storyTileAttr}] > span:first-child {
          box-sizing: border-box;
          display: grid;
          place-items: center;
          width: 62px;
          height: 62px;
          border: 2px solid var(--ig-focus-border);
          border-radius: 50%;
          overflow: hidden;
          font-size: 23px;
        }
        [${storyTileAttr}] img {
          box-sizing: border-box;
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        /* Your story first, then new stories, then the ones already watched. */
        [${storyTileAttr}][data-ig-focus-own] { order: -1; }
        [${storyTileAttr}][${storyStateAttr}="seen"] { order: 1; }
        [${storyTileAttr}][${storyStateAttr}="unseen"] > span:first-child {
          padding: 3px;
          border: 0;
          background: linear-gradient(45deg, #fdc468, #f56040 35%, #e1306c 60%, #a83ab4 85%, #5b51d8);
        }
        [${storyTileAttr}][${storyStateAttr}="unseen"] img {
          border: 2px solid var(--ig-focus-background);
        }
        [${storyTileAttr}][${storyStateAttr}="unseen"] > span:last-child { font-weight: 600; }
        [${storyTileAttr}][${storyStateAttr}="seen"] > span:first-child {
          padding: 3px;
          border: 1px solid var(--ig-focus-border);
        }
        [${storyTileAttr}][${storyStateAttr}="seen"] img { opacity: 0.55; }
        [${storyTileAttr}][${storyStateAttr}="seen"] > span:last-child { opacity: 0.6; }
        [${storyTileAttr}] > span:last-child {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        [data-ig-focus-story-actions] {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          padding: 8px 12px 16px;
        }
        [data-ig-focus-story-actions] button {
          padding: 9px 12px;
          border: 1px solid var(--ig-focus-border);
          border-radius: 8px;
          color: inherit;
          background: transparent;
          font: inherit;
        }
        [${chrome}="story-panel"] [hidden] { display: none !important; }
        html[${viewAttr}="stories"] [${coverAttr}] {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        html[${viewAttr}="stories"] [${coverAttr}] * { pointer-events: none !important; }

        body:has(> [${chrome}="bottom"]) {
          padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)) !important;
        }
        [${chrome}] {
          box-sizing: border-box;
          z-index: 5;
          color: var(--ig-focus-text);
          background-color: var(--ig-focus-background);
          font-family: system-ui, sans-serif;
          transition: none !important;
          --ig-focus-background: #fff;
          --ig-focus-text: #262626;
          --ig-focus-border: #dbdbdb;
        }
        @media (prefers-color-scheme: dark) {
          [${chrome}] {
            --ig-focus-background: #121212;
            --ig-focus-text: #f5f5f5;
            --ig-focus-border: #363636;
          }
        }
        [${chrome}="actions"] {
          position: sticky;
          top: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          padding-inline: 6px;
          border-bottom: 1px solid var(--ig-focus-border);
        }
        [${chrome}="actions"] [role="status"] {
          flex-basis: 100%;
          padding: 6px 10px;
          font-size: 13px;
        }
        [${chrome}="actions"] > div:not([role="status"]) { display: flex; }
        [${chrome}="actions"] [role="status"]:empty,
        html:not([${viewAttr}="stories"]) [${chrome}="actions"] > button:first-child,
        html[${viewAttr}="stories"] [${chrome}="actions"] > div:not([role="status"]) { display: none; }
        [${chrome}="bottom"] {
          position: fixed;
          inset: auto 0 0;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          border-top: 1px solid #303030;
          background-color: #121212;
          color: #fff;
        }
        [${chrome}] > :is(a, button),
        [${chrome}="actions"] > div > button {
          display: grid;
          place-content: center;
          min-height: 44px;
          min-width: 44px;
          padding: 0 10px;
          border: 0;
          color: inherit;
          background: transparent;
          font: inherit;
          font-size: 14px;
          text-decoration: none;
          cursor: pointer;
        }
        [${chrome}="creation"] {
          position: fixed;
          inset: auto 8px calc(56px + env(safe-area-inset-bottom, 0px));
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-inline: 12px 2px;
          border: 1px solid var(--ig-focus-border);
          border-radius: 8px;
          font-size: 13px;
        }
        [${chrome}="creation"] button { font-weight: 650; }
        [${chrome}="bottom"] a { min-height: 55px; }
        /* Keep tab icons white in every link state. Instagram's own a:visited /
           a:active / focus styles load later and used to recolour the Account
           tab (its href is a profile page you have visited). */
        html [${chrome}="bottom"] > a,
        html [${chrome}="bottom"] > a:is(:link, :visited, :hover, :active, :focus, :focus-visible, [aria-busy], [aria-current]) {
          color: #fff !important;
          background: transparent !important;
          outline: none !important;
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
        }
        html [${chrome}="bottom"] > a svg,
        html [${chrome}="bottom"] > a svg * {
          stroke: currentColor !important;
          fill: none !important;
        }
        [${chrome}="bottom"] svg { width: 26px; height: 26px; }
        [${chrome}="bottom"] a[aria-current="page"] svg { stroke-width: 2.7; }
      `;
    }
    if (!style.isConnected) (document.head || root).append(style);
  }

  function refresh() {
    syncRoute();
    if (redirecting || !document.body) return;
    checkProfileOnce();
    const controls = currentView === 'auth' ? [] : nativeControls();
    if (currentView !== 'auth') {
      const previousProfile = ownProfile;
      updateNativeNavigation(controls);
      if (ownProfile !== previousProfile) syncRoute();
    }
    isolateStories(controls);
    updateCovers();
  }

  let refreshPending = false;
  const observer = new MutationObserver(() => {
    if (location.href !== lastCheckedURL || !style?.isConnected) syncRoute();
    if (refreshPending || redirecting) return;
    refreshPending = true;
    requestAnimationFrame(() => {
      refreshPending = false;
      refresh();
    });
  });
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['href', 'src', 'disabled', 'aria-disabled', 'role', 'aria-label', 'aria-labelledby', 'aria-modal', 'aria-hidden', 'hidden', 'title', 'alt', 'open', 'type', 'data-testid', 'data-pagelet']
  });
  refresh();
  window.addEventListener('popstate', refresh);
  window.addEventListener('pageshow', () => {
    redirecting = false;
    creationReturn = readCreationReturn();
    refresh();
  });
  // Isolated extension worlds cannot see page-side History API calls.
  window.setInterval(() => {
    if (location.href !== lastCheckedURL) refresh();
    else if (currentView === 'stories' && !showNativeStories && document.body) updateCovers();
  }, 150);
})();
