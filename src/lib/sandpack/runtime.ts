/**
 * The Visual Inspect bridge that runs INSIDE the Sandpack preview iframe.
 * It draws the hover/selection box and reports `data-studio-id` coordinates to
 * the Studio shell over postMessage.
 */
export const INSPECTOR_RUNTIME = String.raw`
(function () {
  if (window.__studioInspector) return;

  // The preview is a plain bundle, so Tailwind is loaded at runtime via the
  // Play CDN rather than a build step.
  (function ensureTailwind() {
    if (document.getElementById("studio-tailwind")) return;
    var script = document.createElement("script");
    script.id = "studio-tailwind";
    script.src = "https://cdn.tailwindcss.com/3.4.17";
    script.onload = function () {
      // The design system is published as a Tailwind config so that token
      // classes such as bg-primary resolve inside the preview.
      if (window.tailwind && window.__studioTheme) {
        window.tailwind.config = window.__studioTheme;
      }
    };
    document.head.appendChild(script);
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(font);
    var base = document.createElement("style");
    base.textContent =
      "html,body,#root{min-height:100%}body{margin:0;font-family:Inter,system-ui,sans-serif}";
    document.head.appendChild(base);
  })();

  var enabled = false;
  var hoverBox = null;
  var selectedBox = null;
  var badge = null;
  var selectedId = null;

  function ensureNodes() {
    if (hoverBox) return;
    var style = document.createElement("style");
    style.textContent =
      ".studio-box{position:fixed;pointer-events:none;z-index:2147483646;border-radius:2px;transition:all 60ms linear}" +
      ".studio-box--hover{border:1px solid #6366f1;background:rgba(99,102,241,.12)}" +
      ".studio-box--selected{border:1px solid #22d3ee;background:rgba(34,211,238,.10)}" +
      ".studio-badge{position:fixed;z-index:2147483647;pointer-events:none;background:#4f46e5;color:#fff;" +
      "font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:2px 6px;border-radius:3px;white-space:nowrap}";
    document.head.appendChild(style);
    hoverBox = document.createElement("div");
    hoverBox.className = "studio-box studio-box--hover";
    selectedBox = document.createElement("div");
    selectedBox.className = "studio-box studio-box--selected";
    badge = document.createElement("div");
    badge.className = "studio-badge";
    [hoverBox, selectedBox, badge].forEach(function (node) {
      node.style.display = "none";
      document.body.appendChild(node);
    });
  }

  function place(node, rect) {
    node.style.display = "block";
    node.style.top = rect.top + "px";
    node.style.left = rect.left + "px";
    node.style.width = rect.width + "px";
    node.style.height = rect.height + "px";
  }

  function describe(el) {
    var tag = el.tagName.toLowerCase();
    var cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean)[0];
    var id = el.getAttribute("data-studio-id") || "";
    var file = id.split("/").pop();
    return (cls ? tag + "." + cls : tag) + (file ? " · " + file : "");
  }

  function target(event) {
    var node = event.target;
    while (node && node !== document.body) {
      if (node.getAttribute && node.getAttribute("data-studio-id")) return node;
      node = node.parentElement;
    }
    return null;
  }

  function clear() {
    if (hoverBox) hoverBox.style.display = "none";
    if (badge) badge.style.display = "none";
  }

  function refreshSelected() {
    if (!selectedBox) return;
    if (!selectedId) {
      selectedBox.style.display = "none";
      return;
    }
    var el = document.querySelector('[data-studio-id="' + selectedId + '"]');
    if (!el) {
      selectedBox.style.display = "none";
      return;
    }
    place(selectedBox, el.getBoundingClientRect());
  }

  document.addEventListener(
    "mousemove",
    function (event) {
      if (!enabled) return;
      ensureNodes();
      var el = target(event);
      if (!el) return clear();
      var rect = el.getBoundingClientRect();
      place(hoverBox, rect);
      badge.style.display = "block";
      badge.textContent = describe(el);
      badge.style.left = rect.left + "px";
      badge.style.top = Math.max(0, rect.top - 18) + "px";
    },
    true,
  );

  document.addEventListener(
    "click",
    function (event) {
      if (!enabled) return;
      var el = target(event);
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      selectedId = el.getAttribute("data-studio-id");
      ensureNodes();
      refreshSelected();
      parent.postMessage(
        { source: "studio-inspector", type: "select", studioId: selectedId, label: describe(el) },
        "*",
      );
    },
    true,
  );

  document.addEventListener("mouseleave", clear, true);
  window.addEventListener("scroll", refreshSelected, true);
  window.addEventListener("resize", refreshSelected);

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "studio-shell") return;
    if (data.type === "set-inspect") {
      enabled = Boolean(data.enabled);
      ensureNodes();
      if (!enabled) {
        clear();
        selectedBox.style.display = "none";
      } else {
        refreshSelected();
      }
    }
    if (data.type === "set-selected") {
      selectedId = data.studioId || null;
      ensureNodes();
      refreshSelected();
    }
    if (data.type === "preview-class-update") {
      var targetId = data.studioId;
      var newCls = data.className;
      if (targetId && typeof newCls === "string") {
        var el = document.querySelector('[data-studio-id="' + targetId + '"]');
        if (!el) {
          var suffix = targetId.split("/").pop();
          if (suffix) {
            el = document.querySelector('[data-studio-id$="' + suffix + '"]');
          }
        }
        if (el) {
          el.setAttribute("class", newCls);
          if (window.tailwind && typeof window.tailwind.refresh === "function") {
            try {
              window.tailwind.refresh();
            } catch (e) {}
          }
          refreshSelected();
        }
      }
    }
    if (data.type === "preview-text-update") {
      var targetId = data.studioId;
      var newText = data.text;
      if (targetId && typeof newText === "string") {
        var el = document.querySelector('[data-studio-id="' + targetId + '"]');
        if (!el) {
          var suffix = targetId.split("/").pop();
          if (suffix) {
            el = document.querySelector('[data-studio-id$="' + suffix + '"]');
          }
        }
        if (el) {
          el.textContent = newText;
          refreshSelected();
        }
      }
    }
    if (data.type === "set-theme") {
      var colors = data.colors || {};
      var root = document.documentElement;
      if (colors.primary) root.style.setProperty("--color-primary", colors.primary);
      if (colors["primary-hover"] || colors.accent) {
        root.style.setProperty("--color-primary-hover", colors["primary-hover"] || colors.accent);
      }
      if (colors.accent) root.style.setProperty("--color-accent", colors.accent);
      if (colors.surface) root.style.setProperty("--color-surface", colors.surface);
      if (colors.background) {
        root.style.setProperty("--color-background", colors.background);
        document.body.style.backgroundColor = colors.background;
      }
      var isLight =
        colors.background === "#ffffff" ||
        colors.background === "#faf8f5" ||
        colors.background === "#f1f5f9" ||
        colors.background === "#f8fafc";
      var foreground = colors.foreground || (isLight ? "#0f172a" : "#fafafa");
      root.style.setProperty("--color-foreground", foreground);
      document.body.style.color = foreground;
      if (colors.border) root.style.setProperty("--color-border", colors.border);

      if (window.tailwind) {
        try {
          if (!window.tailwind.config) window.tailwind.config = {};
          if (!window.tailwind.config.theme) window.tailwind.config.theme = {};
          if (!window.tailwind.config.theme.extend) window.tailwind.config.theme.extend = {};
          if (!window.tailwind.config.theme.extend.colors) window.tailwind.config.theme.extend.colors = {};
          Object.assign(window.tailwind.config.theme.extend.colors, colors);
          if (typeof window.tailwind.refresh === "function") {
            window.tailwind.refresh();
          }
        } catch (e) {}
      }
      window.__studioTheme = { theme: { extend: { colors: colors } } };
    }
  });

  window.__studioInspector = true;
  parent.postMessage({ source: "studio-inspector", type: "ready" }, "*");
})();
`;

export interface InspectorSelectMessage {
  source: "studio-inspector";
  type: "select";
  studioId: string;
  label: string;
}

export interface InspectorReadyMessage {
  source: "studio-inspector";
  type: "ready";
}

export type InspectorMessage = InspectorSelectMessage | InspectorReadyMessage;

export function isInspectorMessage(value: unknown): value is InspectorMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: string }).source === "studio-inspector"
  );
}
