/* global MutationObserver */

(() => {
  'use strict';

  // =====================================================
  // CONSTANTS
  // =====================================================

  const STORAGE_KEY = 'eds-approval-state';
  const ROLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1CjPAUMvN7TQhPjKw1Dom2kT7iwVPS2YNtEYVdv2-Y30/export?format=csv';

  const ROLE_COLORS = {
    author: '#3f8cff',
    approver: '#ffc107',
    publisher: '#28a745',
  };

  // =====================================================
  // UTILITIES
  // =====================================================

  const deepQuery = (root, selector) => {
    const matches = [];

    const walk = (node) => {
      if (!node) {
        return;
      }

      try {
        node.querySelectorAll(selector).forEach((el) => matches.push(el));
      } catch {
        /* ignore invalid selectors */
      }

      node.childNodes.forEach((child) => {
        walk(child);
        if (child.shadowRoot) {
          walk(child.shadowRoot);
        }
      });

      if (node.shadowRoot) {
        walk(node.shadowRoot);
      }
    };

    walk(root);
    return matches;
  };

  const csvToJson = (csv) => {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (values[i] || '').trim();
      });
      return obj;
    });
  };

  const getUserRole = async (email) => {
    try {
      const csv = await fetch(ROLE_SHEET_URL).then((r) => r.text());
      const rows = csvToJson(csv);
      const match = rows.find((r) => r.email?.toLowerCase() === email.toLowerCase());
      return match?.role || 'author';
    } catch {
      return 'author';
    }
  };

  const getSidekickUserEmail = (sk) => {
    const root = sk.shadowRoot;
    if (!root) {
      return null;
    }

    const items = deepQuery(root, 'sk-menu-item.user');
    if (!items.length) {
      return null;
    }

    const userItem = items[0];
    const sr = userItem.shadowRoot;
    if (!sr) {
      return null;
    }

    const desc = sr.querySelector('span[slot="description"]');
    const text = desc?.textContent?.trim();
    return text && text.includes('@') ? text : null;
  };

  // =====================================================
  // APPROVAL WORKFLOW (localStorage only)
  // =====================================================

  const getState = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  const setStatus = (path, status, comments = '') => {
    const s = getState();
    s[path] = {
      status,
      comments,
      updated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  };

  const getStatus = (path) => {
    const s = getState();
    return s[path] || { status: 'draft' };
  };

  const getPagePath = () => window.location.pathname;

  const openEditorNotice = () => {
    // eslint-disable-next-line no-alert
    alert('EDIT MODE:\n\nOpen your Google Doc / Word document manually.');
  };

  const openPreview = () => {
    const url = window.location.href.replace('.live', '.page');
    window.open(url, '_blank');
  };

  const publishLive = () => {
    const url = window.location.href.replace('.page', '.live');
    window.open(url, '_blank');
  };

  // =====================================================
  // APPLY ROLE CONTROL
  // =====================================================

  const applyRoleRules = (role, sk) => {
    const root = sk.shadowRoot;

    const src = deepQuery(root, 'sk-menu-item.env-edit');
    const prev = deepQuery(root, 'sk-menu-item.env-preview');
    const live = deepQuery(root, 'sk-menu-item.env-live');

    if (role === 'author') {
      prev.forEach((b) => {
        b.style.display = 'none';
      });
      live.forEach((b) => {
        b.style.display = 'none';
      });
    } else if (role === 'approver') {
      live.forEach((b) => {
        b.style.display = 'none';
      });
    }
  };

  const injectRoleBadge = (role, sk) => {
    const badge = document.createElement('div');
    badge.textContent = role.toUpperCase();
    badge.style.cssText = `
      background: ${ROLE_COLORS[role] || '#666'};
      color: #fff;
      padding: 3px 8px;
      border-radius: 4px;
      margin-left: 8px;
      font-size: 11px;
    `;

    const root = sk.shadowRoot;
    const logo = deepQuery(root, '.logo');
    if (logo.length) {
      logo[0].appendChild(badge);
    }
  };

  // =====================================================
  // SIDECICK INIT
  // =====================================================

  const initRoleEngine = () => {
    const sk = document.querySelector('aem-sidekick');

    if (!sk) {
      document.addEventListener('sidekick-ready', initRoleEngine, { once: true });
      return;
    }

    const load = () => {
      const email = getSidekickUserEmail(sk);

      if (!email) {
        // user not signed in → disable SK fully
        const root = sk.shadowRoot;
        root.querySelectorAll('*').forEach((el) => {
          el.style.pointerEvents = 'none';
          el.style.opacity = '0.35';
        });
        return;
      }

      getUserRole(email).then((role) => {
        applyRoleRules(role, sk);
        injectRoleBadge(role, sk);

        new MutationObserver(() => {
          applyRoleRules(role, sk);
        }).observe(sk.shadowRoot, {
          childList: true,
          subtree: true,
        });
      });
    };

    setTimeout(load, 600);
  };

  // =====================================================
  // WORKFLOW EVENTS IN SIDECICK
  // =====================================================

  const registerWorkflowEvents = () => {
    const sk = document.querySelector('aem-sidekick');
    if (!sk) {
      document.addEventListener('sidekick-ready', registerWorkflowEvents, { once: true });
      return;
    }

    const attach = (root) => {
      root.addEventListener('custom:eds-edit', openEditorNotice);

      root.addEventListener('custom:eds-preview', openPreview);

      root.addEventListener('custom:eds-publish-live', () => {
        const path = getPagePath();
        const status = getStatus(path);

        if (status.status !== 'approved') {
          // eslint-disable-next-line no-alert
          alert('Cannot publish — Page must be APPROVED first.');
          return;
        }
        publishLive();
      });

      window.addEventListener('message', (e) => {
        if (e.data?.type === 'getState') {
          window.parent.postMessage(
            {
              sidekick: {
                location: getPagePath(),
                status: getStatus(getPagePath()),
              },
            },
            '*'
          );
        }
      });
    };

    if (sk.shadowRoot) {
      attach(sk.shadowRoot);
    }
  };

  // =====================================================
  // BOOTSTRAP
  // =====================================================

  const init = () => {
    initRoleEngine();
    registerWorkflowEvents();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API (optional)
  window.EDS_WORKFLOW = { setStatus, getStatus };
})();