#!/usr/bin/env node
/**
 * ggb_embed: turn a .ggb file into a drop-in embeddable snippet for an AetherViz
 * single-file lesson HTML.
 *
 * The .ggb (a ZIP of geogebra.xml + defaults) is inlined as base64, so the
 * generated lesson stays ONE file -- no sibling asset, no path juggling.
 *
 * Usage:
 *   node ggb_embed.js --in tri.ggb --id ggb1 --height 420
 *   node ggb_embed.js --in tri.ggb --caption "三角形与外接圆"
 *   node ggb_embed.js --in tri.ggb --view -2,8,-4,4
 *   node ggb_embed.js --in tri.ggb --out embed.html
 *   node ggb_embed.js --in tri.ggb --json          # snippet + css in JSON
 *
 * Flags:
 *   --in <file.ggb>   required
 *   --out <file>      write the snippet to a file (snippet + css printed to stderr)
 *   --id <name>       DOM id of the applet host, default "ggb"
 *   --height <px>     CSS height of the figure, integer 80..2000, default 420
 *   --view x0,x1,y0,y1  world box that must stay visible (a CONTAIN FIT, not an
 *                     exact window -- see buildViewJs). Omit for GeoGebra's own
 *                     content-fitted view.
 *   --app <name>      GeoGebra appName, default "classic" (geometry is WRONG:
 *                     it force-shows the algebra panel -- see references/geogebra-embed.md)
 *   --caption <text>  caption line under the figure
 *   --json            print {ok, input, ggbBytes, base64Bytes, deployJs, snippet, css}
 */

const fs = require('fs');
const path = require('path');

const DEPLOY_JS = 'https://www.geogebra.org/apps/deployggb.js';
const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 2000;
const LOAD_TIMEOUT_MS = 8000;
const LOAD_HARD_TIMEOUT_MS = 45000;   // soft warn at 8s, give up at 45s
const RESIZE_DEBOUNCE_MS = 220;
const RESIZE_SETTLE_MS = 600;

function usage(msg) {
  if (msg) console.error('ERROR: ' + msg);
  console.error('Usage: node ggb_embed.js --in <file.ggb> [--out <file>] [--id <name>]');
  console.error('                    [--height <80..2000>] [--view x0,x1,y0,y1]');
  console.error('                    [--app classic] [--caption <text>] [--json]');
  process.exit(msg ? 2 : 0);
}

function parseArgs(argv) {
  const o = {
    in: null,
    out: null,
    id: 'ggb',
    height: DEFAULT_HEIGHT,
    view: null,
    app: 'classic',
    caption: null,
    json: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], n = argv[i + 1];
    const needsValue = (flag) => {
      if (n === undefined || n === null || n.charAt(0) === '-') {
        usage('missing value for ' + flag);
      }
    };
    // --view takes negative numbers ("-1,6,-1,4"), so a leading '-' is a value
    // here, not the next flag. Require only that something was passed.
    const needsBox = (flag) => {
      if (n === undefined || n === null) usage('missing value for ' + flag);
    };
    switch (a) {
      case '--in': case '-i': needsValue(a); o.in = n; i++; break;
      case '--out': case '-o': needsValue(a); o.out = n; i++; break;
      case '--id': needsValue(a); o.id = n; i++; break;
      case '--height': needsValue(a); o.height = n; i++; break;
      case '--view': needsBox(a); o.view = n; i++; break;
      case '--app': needsValue(a); o.app = n; i++; break;
      case '--caption': needsValue(a); o.caption = n; i++; break;
      case '--json': o.json = true; break;
      case '--help': case '-h': usage(null); break;
      default:
        usage('unknown flag ' + a);
    }
  }
  return o;
}

/** FNV-1a, base36. Only used to disambiguate lossy --id values. */
function shortHash(s) {
  let h = 0x811c9dc5;
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36).slice(0, 5);
}

/**
 * A DOM id must be a valid getElementById key. Stripping illegal characters
 * collapses distinct ids ("a-b" and "ab" both become "ab"), so whenever the
 * input had to be rewritten we append a hash of the original to keep ids on the
 * same page unique.
 */
function safeId(rawId) {
  const raw = String(rawId);
  let s = raw.replace(/[^A-Za-z0-9_]/g, '');
  if (s.charAt(0) >= '0' && s.charAt(0) <= '9') s = 'g' + s;
  if (!s) usage('--id "' + rawId + '" contains no characters usable in a DOM id');
  if (s !== raw) s = s + '_' + shortHash(raw);
  return s;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the embeddable snippet. `opts.height` is the CSS height of the figure
 * in pixels; the width follows the container, so the figure scales with the
 * lesson layout instead of being pinned to a fixed size.
 */
function buildSnippet(opts, b64) {
  const id = safeId(opts.id);
  const viewJs = buildViewJs(opts.view);
  const captionHtml = opts.caption
    ? '\n  <div class="ggb-caption">' + escapeHtml(opts.caption) + '</div>'
    : '';

  return `<div class="ggb-embed" id="${id}-wrap" style="height:${opts.height}px">
  <div class="ggb-stage" id="${id}"></div>${captionHtml}
</div>
<script>
(function () {
  var base64 = "${b64}";
  var LOAD_TIMEOUT = ${LOAD_TIMEOUT_MS};
  var DEBOUNCE = ${RESIZE_DEBOUNCE_MS};
  var SETTLE = ${RESIZE_SETTLE_MS};
  var MAX_WAIT = ${LOAD_HARD_TIMEOUT_MS};

  function mount() {
    var host = document.getElementById("${id}");
    if (!host) return;

    var currentApi = null;   // live applet, so we can tear it down on resize
    var loaded = false;      // appletOnLoad fired for the CURRENT injection
    var timer = null;        // debounce handle (local, never global)
    var watchdog = null;     // async-failure handle
    var pending = null;      // size of an injection still in flight
    var rendered = null;     // size the CURRENT applet was built at
    var settleTimer = null;  // hold on to suppress the observer's own echo

    function showFallback(msg) {
      host.innerHTML = '<div class="ggb-fallback">' + msg + '</div>';
    }

    function destroy() {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      if (currentApi) {
        // Removing the old applet is what stops its timers/canvas from leaking
        // on every re-inject; older builds may not expose remove().
        try { if (typeof currentApi.remove === "function") currentApi.remove(); } catch (e) {}
        currentApi = null;
      }
      pending = null;
    }

    function boot() {
      // GeoGebra Classic measures the applet in PIXELS. Percentages make it
      // collapse to a stub (165x30), and it wraps itself in a fixed-size inline
      // frame, so measure the host and re-inject on resize.
      //
      // Release the host's inline pixel size FIRST. GeoGebra stamps width/height
      // onto it and never removes them, so once a figure shrinks the host stays
      // small forever: clientWidth then reports 704 even inside a 1300px wrapper,
      // and ResizeObserver (watching the host) sees no change, so nothing ever
      // re-injects and the figure can never grow back. Verified before this fix:
      // restoring the viewport 760 -> 1360 stayed at 704x227 indefinitely.
      host.style.width = "";
      host.style.height = "";
      var w = host.clientWidth || 640;
      var h = host.clientHeight || ${DEFAULT_HEIGHT};
      if (w < 40) w = 640;              // collapsed sidebar reports 0
      if (h < 40) h = ${DEFAULT_HEIGHT};
      var size = w + "x" + h;
      // Re-injecting is EXPENSIVE and, worse, self-triggering: the applet writes
      // its own pixel width back onto the host as an inline style, which fires
      // the ResizeObserver below, which re-injects, which sets the width again.
      // Measured drift on a 6-figure page: 1300 -> 1298 -> 1292 -> 1284, with
      // the canvas vanishing and reappearing each round. Skip any size that is
      // not a real change, and stop observing while a figure is being rebuilt.
      if (size === rendered) return;
      if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
      if (pending === size) return;     // an injection is already in flight
      pending = size;

      destroy();
      loaded = false;
      host.innerHTML = "";

      var cfg = {
        appName: ${JSON.stringify(opts.app)},
        width: w,
        height: h,
        showToolBar: false,
        showMenuBar: false,
        showAlgebraInput: false,
        showResetIcon: false,
        enableShiftDragZoom: true,
        enableRightClick: true,
        useBrowserForJS: true,
        ggbBase64: base64,
        appletOnLoad: function (api) {
          if (watchdog) { clearTimeout(watchdog); watchdog = null; }
          loaded = true;
          currentApi = api;${viewJs}
          host.dispatchEvent(new CustomEvent("ggb:ready", {
            bubbles: true, detail: { id: "${id}", api: api }
          }));
        }
      };

      try {
        new GGBApplet(cfg, true).inject("${id}");
      } catch (e) {
        pending = null;
        rendered = null;
        showFallback("动态图初始化失败");
        return;
      }
      // inject() only STARTS the async load, so a try/catch cannot see a corrupt
      // ggbBase64 or a blocked CDN path. Watch for appletOnLoad instead.
      //
      // The watchdog must NOT tear the applet down. Six figures on one lesson
      // page measured 6-9s to first canvas (they serialise GWT module load), and
      // destroying a still-loading applet produced the "动态图加载失败" fallback on
      // figures that were about to render fine. Instead: warn once at LOAD_TIMEOUT,
      // and only give up after MAX_WAIT, while the applet keeps loading untouched.
      watchdog = setTimeout(function () {
        if (loaded) return;
        try { console.warn("[ggb] " + "${id}" + " 仍未加载完成（" + LOAD_TIMEOUT / 1000 + "s）"); } catch (e) {}
        watchdog = setTimeout(function () {
          if (!loaded) {
            pending = null; rendered = null;
            destroy();
            showFallback("动态图加载超时，请检查网络连接后刷新页面");
          }
        }, MAX_WAIT);
      }, LOAD_TIMEOUT);
      // Record the size the applet was BUILT at, not the size it produced: the
      // applet's own inline width differs from ours by a couple of px, and that
      // echo is exactly what re-triggered the observer.
      rendered = size;
      // Ignore resize echoes for a short settle window after injection.
      settleTimer = setTimeout(function () { settleTimer = null; }, SETTLE);
    }

    if (typeof GGBApplet === "undefined") {
      showFallback("动态图加载失败，请检查网络连接");
      return;
    }

    boot();

    // Re-inject when the figure actually changes size (sidebar collapse, window
    // resize). Watch the WRAPPER, not the host: GeoGebra overwrites the host's
    // inline size, so a host-watched observer stops reporting the container's
    // true width and the figure can never grow back after shrinking.
    function onResize() {
      // While a figure is mid-rebuild the observer can see the transient empty
      // state GeoGebra leaves behind; ignoring it stops a destroy/inject cycle.
      if (settleTimer) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(boot, DEBOUNCE);
    }
    var roTarget = host.parentNode || host;
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(onResize).observe(roTarget);
    } else {
      window.addEventListener("resize", onResize);
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
</script>`;
}

function buildCssSnippet() {
  return `<style>
.ggb-embed {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(20, 184, 166, 0.28);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
}
.ggb-embed .ggb-stage {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}
.ggb-embed .ggb-caption {
  flex: 0 0 auto;
  padding: 6px 12px 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #0F172A;
  background: rgba(255, 255, 255, 0.96);
  text-align: center;
}
.ggb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 120px;
  color: #64748B;
  font-size: 14px;
}
</style>`;
}

function parseHeight(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || String(raw).trim() !== String(n)) {
    usage('--height must be an integer, got "' + raw + '"');
  }
  if (n < MIN_HEIGHT || n > MAX_HEIGHT) {
    usage('--height must be between ' + MIN_HEIGHT + ' and ' + MAX_HEIGHT + ', got ' + n);
  }
  return n;
}

/**
 * Parse "--view x0,x1,y0,y1" into a world box. The first two numbers are the x
 * range, the last two the y range, and the spec is order-sensitive: y0 must be
 * the smaller value, because the box is later used as a rectangle.
 */
function parseView(raw) {
  const parts = String(raw).split(',').map((s) => s.trim());
  if (parts.length !== 4) {
    usage('--view must be x0,x1,y0,y1 (4 comma-separated numbers), got "' + raw + '"');
  }
  const nums = parts.map((p) => Number(p));
  for (let i = 0; i < 4; i++) {
    if (!Number.isFinite(nums[i])) {
      usage('--view contains a non-number: "' + parts[i] + '"');
    }
  }
  const [x0, x1, y0, y1] = nums;
  if (x1 <= x0) usage('--view x1 must be greater than x0, got ' + x0 + ',' + x1);
  if (y1 <= y0) usage('--view y1 must be greater than y0, got ' + y0 + ',' + y1);
  return [x0, x1, y0, y1];
}

/**
 * JS for the appletOnLoad callback.
 *
 * Always calls setPerspective("Geometry"): it is the only reliable way to drop
 * the algebra panel (appName:"geometry" force-shows it, and
 * setAlgebraViewVisible() does not exist).
 *
 * With `view` it additionally frames that world box. This is NOT "set the axis
 * limits": setCoordSystem honours a window exactly, but ignores the canvas
 * aspect, so a x[-3,3] y[-4,4] window in a wide figure renders the unit circle
 * as an ellipse.
 *
 * Instead CONTAIN-FIT: grow the box (never shrink) to the canvas aspect ratio,
 * keeping it centred, so
 *   - every requested point is still inside the view (spans only grew), and
 *   - invXscale === invYscale, so circles stay circles at ANY container size.
 *
 * Two ordering facts, both measured:
 *   - setPerspective("Geometry") must run BEFORE setCoordSystem. Called after,
 *     x uses a stale divisor (canvas width - 390) and the axes skew.
 *   - getViewProperties(1) returns a JSON STRING, hence the JSON.parse.
 * See references/geogebra-embed.md.
 */
function buildViewJs(view) {
  if (!view) {
    return `
          try {
            api.setPerspective("Geometry");
          } catch (e) {}`;
  }
  const [x0, x1, y0, y1] = view;
  return `
          try {
            api.setPerspective("Geometry");   // FIRST: makes the spans exact
            var BOX = [${x0}, ${x1}, ${y0}, ${y1}];
            var vp = JSON.parse(api.getViewProperties(1));
            var s = Math.max((BOX[1] - BOX[0]) / vp.width, (BOX[3] - BOX[2]) / vp.height);
            var vx = s * vp.width, vy = s * vp.height;
            var cx = (BOX[0] + BOX[1]) / 2, cy = (BOX[2] + BOX[3]) / 2;
            api.setCoordSystem(cx - vx / 2, cx + vx / 2, cy - vy / 2, cy + vy / 2);
          } catch (e) {}`;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.in) usage('--in <file.ggb> is required');
  opts.height = parseHeight(opts.height);
  if (opts.view !== null) opts.view = parseView(opts.view);

  const inPath = path.resolve(opts.in);
  let stat;
  try {
    stat = fs.statSync(inPath);
  } catch (e) {
    console.error('ERROR: cannot stat file: ' + inPath);
    process.exit(1);
  }
  if (stat.isDirectory()) {
    console.error('ERROR: --in must be a .ggb file, not a directory: ' + inPath);
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(inPath);
  } catch (e) {
    console.error('ERROR: cannot read file: ' + inPath + ' (' + e.code + ')');
    process.exit(1);
  }
  if (raw.length === 0) {
    console.error('ERROR: file is empty: ' + inPath);
    process.exit(1);
  }

  const b64 = raw.toString('base64');
  const snippet = buildSnippet(opts, b64);
  const css = buildCssSnippet();

  if (opts.out) {
    const outPath = path.resolve(opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, snippet, 'utf8');
  }

  if (opts.json) {
    // Keep snippet AND css: references/geogebra-embed.md documents reading both
    // from this payload.
    console.log(JSON.stringify({
      ok: true,
      input: inPath,
      id: safeId(opts.id),
      height: opts.height,
      view: opts.view,
      app: opts.app,
      ggbBytes: raw.length,
      base64Bytes: b64.length,
      deployJs: DEPLOY_JS,
      snippet,
      css,
    }, null, 2));
    return;
  }

  if (opts.out) {
    console.error('wrote snippet to ' + path.resolve(opts.out));
    console.error('\n--- add once in <head> ---');
    console.error(css);
  } else {
    console.log(snippet);
    console.error('\n--- add once in <head> ---');
    console.error(css);
  }
}

main();
