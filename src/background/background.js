const ext = typeof browser !== "undefined" ? browser : chrome;

const pendingEmailsByTab = {};

const PROVIDERS = {
  "gmail.com": (email) =>
    "https://accounts.google.com/ServiceLogin" +
    "?service=mail" +
    "&Email=" + encodeURIComponent(email),

  "googlemail.com": (email) =>
    "https://accounts.google.com/ServiceLogin" +
    "?service=mail" +
    "&Email=" + encodeURIComponent(email),

  "outlook.com": (email) =>
    "https://login.live.com/login.srf" +
    "?login=" + encodeURIComponent(email),

  "hotmail.com": (email) =>
    "https://login.live.com/login.srf" +
    "?login=" + encodeURIComponent(email),

  "live.com": (email) =>
    "https://login.live.com/login.srf" +
    "?login=" + encodeURIComponent(email),

  "msn.com": (email) =>
    "https://login.live.com/login.srf" +
    "?login=" + encodeURIComponent(email),

  "yahoo.com": (email) =>
    "https://login.yahoo.com/" +
    "?username=" + encodeURIComponent(email),

  "icloud.com": (_email) =>
    "https://www.icloud.com/mail"
};

ext.omnibox.onInputChanged.addListener((text, suggest) => {
  suggest([
    {
      content: text,
      description: `Hop to inbox for <match>${text}</match>`
    }
  ]);
});

ext.omnibox.onInputEntered.addListener((text, disposition) => {
  handlePostHopInput(text, disposition);
})

async function handlePostHopInput(text, disposition) {
  const email = text.trim();
  if (!isValidEmail(email)) return;

  const url = buildUrlFromEmail(email);

  let tab;
  if (disposition === "currentTab") {
    const [current] = await ext.tabs.query({ active: true, currentWindow: true })
    tab = await ext.tabs.update(current.id, { url });
  } else {
    tab = await ext.tabs.create({
      url,
      active: disposition !== "newBackgroundTab"
    });
  }

  pendingEmailsByTab[tab.id] = email;
}

function isValidEmail(str) {
  return /\S+@\S+\.\S+/.test(str);
}

function buildUrlFromEmail(email) {
  const domain = email.split('@')[1].toLowerCase();
  const providerBuilder = PROVIDERS[domain];

  if (providerBuilder) {
    return providerBuilder(email);
  }

  return "https://" + domain;
}

ext.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;

  const email = pendingEmailsByTab[tabId];
  if (!email) return;

  if (!tab.url) return;

  injectEmailFiller(tabId, email);

  delete pendingEmailsByTab[tabId];
});

function fillAndFocusEmailField(email) {
  const candidates = [
    'input[type="email"]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][id*="email" i]',
    'input[autocomplete="email"]',
    'input[autocomplete="username"]'
  ];

  let input = null;
  for (const selector of candidates) {
    input = document.querySelector(selector);
    if (input) break;
  }

  input.value = email;

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  input.focus();
}

function injectEmailFiller(tabId, email) {
  if (ext.scripting && ext.scripting.executeScript) {
    ext.scripting.executeScript({
      target: { tabId },
      func: fillAndFocusEmailField,
      args: [email]
    });
  } else {
    const code = `(${fillAndFocusEmailField.toString()})(${JSON.stringify(email)});`;
    ext.tabs.executeScript(tabId, { code });
  }
}
