const color = (value) => {
  const parts = (value.match(/[\d.]+/g) || []).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
};
const mix = (foreground, background, alpha) => foreground.map((v, i) => v * alpha + background[i] * (1 - alpha));
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
async function visibleInk(page) {
  return page.evaluate(() => {
    const scope = document.querySelector(".modal-layer:last-of-type") || document.querySelector(".game-shell,.loading");
    const items = [];
    const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
    const owner = (el) => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "");
    const hiddenInDetails = (parent) => {
      for (let details = parent.closest("details"); details; details = details.parentElement?.closest("details") ?? null) if (!details.open && !details.querySelector(":scope > summary")?.contains(parent)) return true;
      return false;
    };
    function add(parent, text, rect, pseudo) {
      const style = getComputedStyle(parent, pseudo);
      if (hiddenInDetails(parent) || parent.closest(".sr-only,[aria-hidden=true]") || style.display === "none" || style.visibility === "hidden") return;
      let opacity = 1, opacityBackground = null, nearestOpaque = null, opacityGroupSeen = false, left = 0, top = 0, right = innerWidth, bottom = innerHeight;
      for (let el = parent; el; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (!opacityGroupSeen) {
          const channels = (s.backgroundColor.match(/[\d.]+/g) || []).map(Number);
          if (!nearestOpaque && channels.length >= 3 && (channels[3] ?? 1) === 1) nearestOpaque = s.backgroundColor;
          if (Number(s.opacity) < 1) {
            opacityBackground = nearestOpaque;
            opacityGroupSeen = true;
          }
        }
        opacity *= Number(s.opacity);
        if (el !== parent && /(auto|scroll|hidden)/.test(s.overflowY + s.overflowX)) {
          const r = el.getBoundingClientRect();
          left = Math.max(left, r.left);
          right = Math.min(right, r.right);
          top = Math.max(top, r.top);
          bottom = Math.min(bottom, r.bottom);
        }
      }
      if (opacity < 0.01) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(parent.tagName)) {
        const r = parent.getBoundingClientRect(), field = getComputedStyle(parent);
        left = Math.max(left, r.left + parseFloat(field.paddingLeft));
        right = Math.min(right, r.right - parseFloat(field.paddingRight));
        top = Math.max(top, r.top + parseFloat(field.paddingTop));
        bottom = Math.min(bottom, r.bottom - parseFloat(field.paddingBottom));
      }
      const clipped = { left: Math.max(rect.left, left), right: Math.min(rect.right, right), top: Math.max(rect.top, top), bottom: Math.min(rect.bottom, bottom), width: 0, height: 0 };
      clipped.width = clipped.right - clipped.left;
      clipped.height = clipped.bottom - clipped.top;
      if (clipped.width < 2 || clipped.height < 4 || clipped.width * clipped.height < rect.width * rect.height * 0.55) return;
      const fill = style.webkitTextFillColor;
      items.push({ text, owner: owner(parent), rect: clipped, color: fill && fill !== "currentcolor" ? fill : style.color, strokeColor: style.webkitTextStrokeColor, strokeWidth: parseFloat(style.webkitTextStrokeWidth) || 0, opacity, opacityBackground, fontSize: parseFloat(style.fontSize), fontWeight: parseInt(style.fontWeight) || 400, disabled: !!parent.closest(":disabled,[aria-disabled=true]"), control: !!parent.closest("button,input,select,textarea") });
    }
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement, text = node.textContent?.trim() || "";
      if (!parent || !text || /^[·•:|/–—\-\s]+$/u.test(text) || parent.closest("script,style,option,input,textarea")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) if (rect.width && rect.height) add(parent, text, box(rect));
    }
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    for (const element of scope.querySelectorAll("input,textarea,select")) {
      const input = element;
      const isSelect = input.tagName === "SELECT", isTextarea = input.tagName === "TEXTAREA";
      const text = isSelect ? input.selectedOptions?.[0]?.textContent || "" : input.value || input.placeholder;
      if (!text) continue;
      const style = getComputedStyle(input), bounds = input.getBoundingClientRect(), left = bounds.left + parseFloat(style.paddingLeft), right = bounds.right - parseFloat(style.paddingRight), fontSize = parseFloat(style.fontSize);
      ctx.font = style.font;
      const available = right - left, lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
      const lines = [];
      if (isTextarea) {
        for (const paragraph of text.split("\n")) {
          let line = "";
          for (const char of paragraph) {
            if (line && ctx.measureText(line + char).width > available) {
              lines.push(line);
              line = "";
            }
            line += char;
          }
          lines.push(line);
        }
      } else lines.push(text);
      for (const [lineIndex, line] of lines.entries()) {
        const width = Math.min(available, ctx.measureText(line).width), top = isTextarea ? bounds.top + parseFloat(style.paddingTop) + (lineHeight - fontSize) / 2 + lineIndex * lineHeight - input.scrollTop : (bounds.top + bounds.bottom - fontSize) / 2;
        add(input, line, { left, top, right: left + width, bottom: top + fontSize, width, height: fontSize }, !isSelect && !input.value ? "::placeholder" : void 0);
      }
    }
    return items;
  });
}

export {visibleInk};
