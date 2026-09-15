// ==UserScript==
// @name         ChatGPT Exporter - Root Cellar Read-only Guard
// @namespace    lena-rootcellar
// @version      0.2.0
// @description  Keep ChatGPT Exporter read-only and provide a fallback mount when ChatGPT changes the sidebar profile selector.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const PROFILE_SELECTOR = '[data-testid="accounts-profile-button"]';
  const FALLBACK_WRAPPER_ID = 'rootcellar-exporter-fallback-wrapper';
  const FALLBACK_ANCHOR_ID = 'rootcellar-exporter-fallback-anchor';

  // --- Read-only safety -----------------------------------------------------
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

  // --- Mount fallback -------------------------------------------------------
  // The upstream exporter currently waits for ChatGPT's
  // [data-testid="accounts-profile-button"]. If ChatGPT renames/removes that
  // internal selector, the exporter is running but has nowhere to mount.
  // We provide a synthetic matching anchor in a fixed wrapper. The exporter
  // inserts its own UI immediately before this hidden anchor.
  function findNativeProfileTarget() {
    return Array.from(document.querySelectorAll(PROFILE_SELECTOR))
      .find((el) => el.id !== FALLBACK_ANCHOR_ID) || null;
  }

  function removeFallbackMount() {
    document.getElementById(FALLBACK_WRAPPER_ID)?.remove();
  }

  function ensureFallbackMount() {
    if (!document.body) return;

    // Prefer the real ChatGPT sidebar target whenever it exists.
    if (findNativeProfileTarget()) {
      removeFallbackMount();
      return;
    }

    if (document.getElementById(FALLBACK_WRAPPER_ID)) return;

    const wrapper = document.createElement('div');
    wrapper.id = FALLBACK_WRAPPER_ID;
    wrapper.style.cssText = [
      'position:fixed',
      'left:14px',
      'bottom:14px',
      'z-index:2147483000',
      'width:210px',
      'display:flex',
      'flex-direction:column',
      'align-items:stretch'
    ].join(';');

    // Keep two children in the wrapper so the upstream insertion helper
    // inserts its menu inside this fixed wrapper, directly before the anchor.
    const spacer = document.createElement('span');
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.display = 'none';

    const anchor = document.createElement('button');
    anchor.id = FALLBACK_ANCHOR_ID;
    anchor.setAttribute('data-testid', 'accounts-profile-button');
    anchor.setAttribute('aria-hidden', 'true');
    anchor.tabIndex = -1;
    anchor.style.display = 'none';

    wrapper.append(spacer, anchor);
    document.body.append(wrapper);
    console.info('[Root Cellar Guard] Added fallback mount for ChatGPT Exporter.');
  }

  function maintain() {
    hideDestructiveExporterButtons();
    ensureFallbackMount();
  }

  const observer = new MutationObserver(maintain);
  const start = () => {
    maintain();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
