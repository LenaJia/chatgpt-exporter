// ==UserScript==
// @name         ChatGPT Exporter - Root Cellar Read-only Guard
// @namespace    lena-rootcellar
// @version      0.1.0
// @description  Prevent ChatGPT Exporter from archiving or deleting conversations while keeping export functions available.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    const isConversationWrite = /\/backend-api\/conversation\//.test(url) && (method === 'PATCH' || method === 'DELETE');
    if (isConversationWrite) {
      console.warn('[Root Cellar Guard] Blocked conversation write:', method, url);
      throw new Error('Root Cellar read-only guard blocked a conversation write request.');
    }

    return originalFetch(input, init);
  };

  function hideDestructiveExporterButtons() {
    for (const button of document.querySelectorAll('button')) {
      const text = (button.textContent || '').trim().toLowerCase();
      if (text === 'archive' || text === 'delete') {
        const dialog = button.closest('[role="dialog"], .DialogContent');
        if (dialog) button.style.display = 'none';
      }
    }
  }

  const observer = new MutationObserver(hideDestructiveExporterButtons);
  const start = () => {
    hideDestructiveExporterButtons();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
