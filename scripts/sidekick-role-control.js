/**
 * PURE JS ROLE-BASED SIDECICK CUSTOMIZATION
 * ------------------------------------------
 * Features:
 * ✔ Auto-detect any depth of shadow DOM
 * ✔ Find environment buttons (Source / Preview / Live)
 * ✔ Hide/show buttons based on spreadsheet role
 * ✔ Insert role badge in Sidekick UI
 */

// ---------------------- CONFIG ----------------------

// PUBLISHED GOOGLE SHEET (CSV)
const ROLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1CjPAUMvN7TQhPjKw1Dom2kT7iwVPS2YNtEYVdv2-Y30/export?format=csv";

// Role color mapping for badges
const ROLE_COLORS = {
  author: "#3f8cff",
  approver: "#ffc107",
  publisher: "#28a745"
};

// ---------------------- UTILITIES ----------------------

/**
 * Recursively search all shadow DOM levels for a selector
 */
function deepQuery(root, selector) {
  const matches = [];

  function search(node) {
    if (!node) return;

    // Try normal querySelectorAll
    try {
      node.querySelectorAll(selector)?.forEach(el => matches.push(el));
    } catch {}

    // Traverse children + shadow roots
    node.childNodes.forEach(child => {
      search(child);
      if (child.shadowRoot) search(child.shadowRoot);
    });

    // If current node has shadow root
    if (node.shadowRoot) {
      search(node.shadowRoot);
    }
  }

  search(root);
  return matches;
}

/**
 * Parse CSV → JSON
 */
function csvToJson(csv) {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map(row => {
    const values = row.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = values[i]?.trim()));
    return obj;
  });
}

/**
 * Fetch role of current user from spreadsheet
 */
async function getUserRole(email) {
  try {
    const csv = await fetch(ROLE_SHEET_URL).then(r => r.text());
    const rows = csvToJson(csv);

    const match = rows.find(r => r.email?.toLowerCase() === email.toLowerCase());
    return match?.role || "author";
  } catch (e) {
    console.error("Role sheet error:", e);
    return "author"; // default role
  }
}

// ---------------------- SIDECICK INTERACTION ----------------------

/**
 * Hide environment buttons based on role
 */
function applyRoleRules(role, sk) {
  const root = sk.shadowRoot;

  // Auto-detect env buttons via deep query
  const sourceBtns  = deepQuery(root, "sk-menu-item.env-edit");
  const previewBtns = deepQuery(root, "sk-menu-item.env-preview");
  const liveBtns    = deepQuery(root, "sk-menu-item.env-live");

  if (role === "author") {
    previewBtns.forEach(b => (b.style.display = "none"));
    liveBtns.forEach(b => (b.style.display = "none"));
  }

  if (role === "approver") {
    liveBtns.forEach(b => (b.style.display = "none"));
  }

  // publisher → can see all
}

/**
 * Add Role Badge to Sidekick UI
 */
function injectRoleBadge(role, sk) {
  const badge = document.createElement("div");
  badge.textContent = role.toUpperCase();
  badge.style.cssText = `
    background: ${ROLE_COLORS[role] || "#666"};
    color: white;
    padding: 3px 8px;
    font-size: 11px;
    border-radius: 4px;
    margin-left: 10px;
    display: inline-block;
  `;

  // Insert badge inside the top bar next to logo
  const root = sk.shadowRoot;
  const logoArea = deepQuery(root, ".logo");

  if (logoArea.length) {
    logoArea[0].appendChild(badge);
  }
}

// ---------------------- MAIN INIT LOGIC ----------------------

function initSidekickRoleControl() {
  const sk = document.querySelector("aem-sidekick");
  if (!sk || !sk.shadowRoot) {
    // Wait for sidekick
    document.addEventListener("sidekick-ready", initSidekickRoleControl, { once: true });
    return;
  }

  // Get current user email
  // Sidekick exposes the user via config
  const email = sk.config?.project?.user?.email || sk.config?.user?.email;

  if (!email) {
    console.warn("Cannot read Sidekick user email.");
    return;
  }

  // Get role → then apply updates
  getUserRole(email).then(role => {
    console.log("Sidekick Role Assigned:", role);

    applyRoleRules(role, sk);
    injectRoleBadge(role, sk);

    // Apply again if UI re-renders
    new MutationObserver(() => {
      applyRoleRules(role, sk);
    }).observe(sk.shadowRoot, { childList: true, subtree: true });
  });
}

// Startup
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSidekickRoleControl);
} else {
  initSidekickRoleControl();
}
