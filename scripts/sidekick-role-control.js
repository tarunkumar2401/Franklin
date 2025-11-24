/* global MutationObserver */

var ROLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1CjPAUMvN7TQhPjKw1Dom2kT7iwVPS2YNtEYVdv2-Y30/export?format=csv';

var ROLE_COLORS = {
  author: '#3f8cff',
  approver: '#ffc107',
  publisher: '#28a745'
};

function deepQuery(root, selector) {
  var results = [];

  function walk(node) {
    if (!node) {
      return;
    }

    try {
      var found = node.querySelectorAll(selector);
      if (found && found.length > 0) {
        found.forEach(function (el) {
          results.push(el);
        });
      }
    } catch (err) {
      // ignore
    }

    node.childNodes.forEach(function (child) {
      walk(child);
      if (child.shadowRoot) {
        walk(child.shadowRoot);
      }
    });

    if (node.shadowRoot) {
      walk(node.shadowRoot);
    }
  }

  walk(root);
  return results;
}

function csvToJson(csv) {
  var lines = csv.trim().split('\n');
  var headers = lines[0].split(',');
  return lines.slice(1).map(function (row) {
    var values = row.split(',');
    var obj = {};
    headers.forEach(function (h, i) {
      obj[h.trim()] = values[i] ? values[i].trim() : '';
    });
    return obj;
  });
}

function getUserRole(email) {
  return fetch(ROLE_SHEET_URL)
    .then(function (r) {
      return r.text();
    })
    .then(function (csv) {
      var rows = csvToJson(csv);
      var match = rows.find(function (r) {
        return r.email && r.email.toLowerCase() === email.toLowerCase();
      });
      return match ? match.role : 'author';
    })
    .catch(function () {
      return 'author';
    });
}

function applyRoleRules(role, sk) {
  var root = sk.shadowRoot;
  var previewBtns = deepQuery(root, 'sk-menu-item.env-preview');
  var liveBtns = deepQuery(root, 'sk-menu-item.env-live');

  if (role === 'author') {
    previewBtns.forEach(function (b) {
      b.style.display = 'none';
    });
    liveBtns.forEach(function (b) {
      b.style.display = 'none';
    });
  }

  if (role === 'approver') {
    liveBtns.forEach(function (b) {
      b.style.display = 'none';
    });
  }
}

function injectRoleBadge(role, sk) {
  var badge = document.createElement('div');
  badge.textContent = role.toUpperCase();
  badge.style.background = ROLE_COLORS[role] || '#666';
  badge.style.color = '#fff';
  badge.style.fontSize = '11px';
  badge.style.padding = '4px 10px';
  badge.style.borderRadius = '4px';
  badge.style.marginLeft = '12px';
  badge.style.display = 'inline-block';

  var areas = deepQuery(sk.shadowRoot, '.logo');
  if (areas.length > 0) {
    areas[0].appendChild(badge);
  }
}

function initSidekickRoleControl() {
  var sk = document.querySelector('aem-sidekick');
  if (!sk || !sk.shadowRoot) {
    document.addEventListener(
      'sidekick-ready',
      function () {
        initSidekickRoleControl();
      },
      { once: true }
    );
    return;
  }

  var email =
    (sk.config &&
      sk.config.project &&
      sk.config.project.user &&
      sk.config.project.user.email) ||
    (sk.config && sk.config.user && sk.config.user.email) ||
    '';

  if (!email) {
    return;
  }

  getUserRole(email).then(function (role) {
    applyRoleRules(role, sk);
    injectRoleBadge(role, sk);

    var observer = new MutationObserver(function () {
      applyRoleRules(role, sk);
    });

    observer.observe(sk.shadowRoot, { childList: true, subtree: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidekickRoleControl);
} else {
  initSidekickRoleControl();
}
