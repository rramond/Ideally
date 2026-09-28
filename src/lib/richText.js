/* ============================================================
   Rich text helpers for board items: styling a selection,
   tidying the DOM afterwards, and sanitizing stored HTML
============================================================ */
const ALLOWED_STYLES = ['fontWeight', 'fontStyle', 'fontSize', 'color'];
const DROP_TAGS = ['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED'];

export function unwrap(el){ el.replaceWith(...el.childNodes); }

/* keep only text, <br>, <div> and <span> with the four styles we use */
export function sanitizeHtml(html){
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  (function clean(node){
    [...node.childNodes].forEach(ch => {
      if (ch.nodeType === Node.TEXT_NODE) return;
      if (ch.nodeType !== Node.ELEMENT_NODE || DROP_TAGS.includes(ch.tagName)){ ch.remove(); return; }
      clean(ch);
      if (ch.tagName !== 'SPAN' && ch.tagName !== 'DIV' && ch.tagName !== 'BR'){ unwrap(ch); return; }
      const keep = {};
      ALLOWED_STYLES.forEach(p => { if (ch.style[p]) keep[p] = ch.style[p]; });
      [...ch.attributes].forEach(a => ch.removeAttribute(a.name));
      Object.assign(ch.style, keep);
    });
  })(tpl.content);
  return tpl.innerHTML;
}

/* drop spans that no longer carry a style or any content, merge text nodes */
export function tidy(root){
  root.querySelectorAll('span').forEach(x => {
    if (!x.getAttribute('style')) unwrap(x);
    else if (!x.textContent && !x.querySelector('br')) x.remove();
  });
  root.normalize();
}

export function stripStyle(root, prop){
  root.querySelectorAll('span').forEach(x => { x.style[prop] = ''; });
  tidy(root);
}

/* wrap the selected content in a span with `prop: value`; returns a range over it */
export function styleRange(root, range, prop, value){
  const span = document.createElement('span');
  span.style[prop] = value;
  span.appendChild(range.extractContents());
  span.querySelectorAll('span').forEach(x => { x.style[prop] = ''; });
  range.insertNode(span);
  tidy(root);
  /* re-styling the same selection would nest spans; fold into the parent instead */
  let target = span;
  const par = span.parentNode;
  if (par !== root && par.tagName === 'SPAN' && par.childNodes.length === 1){
    par.style[prop] = value;
    unwrap(span);
    target = par;
  }
  const r = document.createRange();
  r.selectNodeContents(target);
  return r;
}

function textNodesIn(range){
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) return [root];
  const out = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (w.nextNode()){
    const n = w.currentNode;
    if (!n.textContent.trim() || !range.intersectsNode(n)) continue;
    if (n === range.endContainer && range.endOffset === 0) continue;
    if (n === range.startContainer && range.startOffset === n.length) continue;
    out.push(n);
  }
  return out;
}

/* true when every selected character passes test(computedStyle) */
export function rangeEvery(range, test){
  const nodes = textNodesIn(range);
  return nodes.length > 0 && nodes.every(n => test(getComputedStyle(n.parentElement)));
}

export function rangeStartElement(range){
  let n = range.startContainer;
  if (n.nodeType !== Node.TEXT_NODE && n.childNodes[range.startOffset]) n = n.childNodes[range.startOffset];
  return n.nodeType === Node.TEXT_NODE ? n.parentElement : n;
}

export function rgbToHex(rgb){
  const m = rgb.match(/\d+/g) || ['0', '0', '0'];
  return '#' + m.slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
}
