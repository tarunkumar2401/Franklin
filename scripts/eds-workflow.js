(function () {
  var STORAGE_KEY = 'eds-approval-state';

  function getState() {
    var raw = localStorage.getItem(STORAGE_KEY) || '{}';
    return JSON.parse(raw);
  }

  function setStatus(path, status, comments) {
    var s = getState();
    s[path] = {
      status: status,
      comments: comments || '',
      updated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function getStatus(path) {
    var s = getState();
    if (s[path]) {
      return s[path];
    }
    return { status: 'draft' };
  }

  function getPagePath() {
    return window.location.pathname;
  }

  function openEditorNotice() {
    // eslint-disable-next-line no-alert
    alert('EDIT MODE:\n\nOpen your Google Doc / Word file manually.\n(This is a pure JS workflow; no backend available.)');
  }

  function openPreview() {
    var url = window.location.href.replace('.live', '.page');
    window.open(url, '_blank');
  }

  function publishToLive() {
    var url = window.location.href.replace('.page', '.live');
    window.open(url, '_blank');
  }

  function onSidekickReady(root) {
    root.addEventListener('custom:eds-edit', function () {
      openEditorNotice();
    });

    root.addEventListener('custom:eds-preview', function () {
      openPreview();
    });

    root.addEventListener('custom:eds-publish-live', function () {
      var path = getPagePath();
      var state = getStatus(path);
      if (state.status !== 'approved') {
        // eslint-disable-next-line no-alert
        alert('Cannot publish.\nPreview must be APPROVED first.');
        return;
      }
      publishToLive();
    });

    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'getState') {
        window.parent.postMessage(
          {
            sidekick: {
              location: getPagePath(),
              status: getStatus(getPagePath())
            }
          },
          '*'
        );
      }
    });
  }

  function registerSidekick() {
    var sk = document.querySelector('aem-sidekick');

    if (sk) {
      onSidekickReady(sk);
    } else {
      document.addEventListener(
        'sidekick-ready',
        function () {
          var sk2 = document.querySelector('aem-sidekick');
          if (sk2) {
            onSidekickReady(sk2);
          }
        },
        { once: true }
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerSidekick);
  } else {
    registerSidekick();
  }

  window.EDS_WORKFLOW = {
    setStatus: setStatus,
    getStatus: getStatus
  };
}());
