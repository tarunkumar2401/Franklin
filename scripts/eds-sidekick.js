(() => {
  const STORAGE_KEY = 'eds-approval-state';
  const ROLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1CjPAUMvN7TQhPjKw1Dom2kT7iwVPS2YNtEYVdv2-Y30/export?format=csv';

  const ROLE_COLORS = {
    author: '#3f8cff',
    approver: '#ffc107',
    publisher: '#28a745',
  };

  // ----------------------------------------------------
  // Deep shadow DOM query
  // ----------------------------------------------------
  const deepQuery = (root, selector) => {
    const matches = [];

    const walk = (node) => {
      if (!node) {
        return;
      }

      try {
        node.querySelectorAll(selector).forEach((el) => {
          matches.push(el);
        });
      } catch {
        // ignore invalid selectors
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

  // ----------------------------------------------------
  // CSV helpers / role sheet
  // ----------------------------------------------------
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
      const match = rows.find((r) => r.email && r.email.toLowerCase() === email.toLowerCase());
      return match && match.role ? match.role : 'author';
    } catch {
      return 'author';
    }
  };

  // ----------------------------------------------------
  // Read user email from Sidekick DOM (B1)
  // ----------------------------------------------------
  const getSidekickUserEmail = (sk) => {
    const root = sk.shadowRoot;
    if (!root) {
      return null;
    }

    const userItems = deepQuery(root, 'sk-menu-item.user');
    if (!userItems.length) {
      return null;
    }

    const userItem = userItems[0];
    const sr = userItem.shadowRoot;
    if (!sr) {
      return null;
    }

    const desc = sr.querySelector('span[slot="description"]');
    const text = desc && desc.textContent ? desc.textContent.trim() : '';
    if (text && text.indexOf('@') !== -1) {
      return text;
    }

    return null;
  };

  // ----------------------------------------------------
  // Disable Sidekick UI when not signed in (A2)
  // ----------------------------------------------------
  const disableSidekickUi = (sk) => {
    const root = sk.shadowRoot;
    if (!root) {
      return;
    }

    const interactiveSelectors = [
      'sk-action-button',
      'sk-menu-item',
      'button',
      'sp-switch',
      'sk-action-menu',
    ];

    interactiveSelectors.forEach((selector) => {
      deepQuery(root, selector).forEach((el) => {
        const element = el;
        // keep login-button clickable so user can sign in
        if (element.closest && element.closest('login-button')) {
          return;
        }
        element.style.pointerEvents = 'none';
        element.style.opacity = '0.35';
      });
    });

    const logos = deepQuery(root, '.logo');
    if (logos.length) {
      const note = document.createElement('div');
      note.textContent = 'Sign in to use Sidekick';
      note.style.cssText = 'margin-left:8px;font-size:11px;color:#ffb200;';
      logos[0].appendChild(note);
    }
  };

  // ----------------------------------------------------
  // Approval workflow (localStorage)
  // ----------------------------------------------------
  const getState = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  const setStatus = (path, status, comments = '') => {
    const state = getState();
    state[path] = {
      status,
      comments,
      updated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const getStatus = (path) => {
    const state = getState();
    if (state[path]) {
      return state[path];
    }
    return { status: 'draft' };
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

  // ----------------------------------------------------
  // Role rules & badge
  // ----------------------------------------------------
  const applyRoleRules = (role, sk) => {
    const root = sk.shadowRoot;
    if (!root) {
      return;
    }

    const previewItems = deepQuery(root, 'sk-menu-item.env-preview');
    const liveItems = deepQuery(root, 'sk-menu-item.env-live');

    if (role === 'author') {
      previewItems.forEach((item) => {
        const element = item;
        element.style.display = 'none';
      });
      liveItems.forEach((item) => {
        const element = item;
        element.style.display = 'none';
      });
    } else if (role === 'approver') {
      liveItems.forEach((item) => {
        const element = item;
        element.style.display = 'none';
      });
    }
  };

  const injectRoleBadge = (role, sk) => {
    const root = sk.shadowRoot;
    if (!root) {
      return;
    }

    const logos = deepQuery(root, '.logo');
    if (!logos.length) {
      return;
    }

    const badge = document.createElement('div');
    badge.textContent = role.toUpperCase();
    badge.style.cssText = `
      background:${ROLE_COLORS[role] || '#666'};
      color:#fff;
      padding:3px 8px;
      border-radius:4px;
      margin-left:8px;
      font-size:11px;
    `;

    logos[0].appendChild(badge);
  };

  // ----------------------------------------------------
  // Workflow event wiring into Sidekick
  // ----------------------------------------------------
  const registerWorkflowEvents = (sk) => {
    const root = sk.shadowRoot;
    if (!root) {
      return;
    }

    root.addEventListener('custom:eds-edit', () => {
      openEditorNotice();
    });

    root.addEventListener('custom:eds-preview', () => {
      openPreview();
    });

    root.addEventListener('custom:eds-publish-live', () => {
      const path = getPagePath();
      const current = getStatus(path);
      if (current.status !== 'approved') {
        // eslint-disable-next-line no-alert
        alert('Cannot publish — page must be APPROVED first.');
        return;
      }
      publishLive();
    });

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'getState') {
        window.parent.postMessage(
          {
            sidekick: {
              location: getPagePath(),
              status: getStatus(getPagePath()),
            },
          },
          '*',
        );
      }
    });
  };

  // ----------------------------------------------------
  // Main bootstrap
  // ----------------------------------------------------
  const initSidekick = () => {
    const sk = document.querySelector('aem-sidekick');
    if (!sk) {
      document.addEventListener(
        'sidekick-ready',
        () => {
          initSidekick();
        },
        { once: true },
      );
      return;
    }

    const email = getSidekickUserEmail(sk);
    if (!email) {
      disableSidekickUi(sk);
      registerWorkflowEvents(sk);
      return;
    }

    getUserRole(email).then((role) => {
      applyRoleRules(role, sk);
      injectRoleBadge(role, sk);
      registerWorkflowEvents(sk);

      const observer = new MutationObserver(() => {
        applyRoleRules(role, sk);
      });

      observer.observe(sk.shadowRoot, {
        childList: true,
        subtree: true,
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidekick);
  } else {
    initSidekick();
  }

  // expose workflow API for palettes
  window.EDS_WORKFLOW = {
    setStatus,
    getStatus,
  };
})();
