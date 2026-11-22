(function () {
  var lines = [];
  var box = null;
  function render() {
    if (!document.body) return;
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:40%;overflow:auto;z-index:2147483647;background:rgba(0,0,0,.85);color:#7CFC00;font:11px monospace;padding:6px;white-space:pre-wrap;';
      box.addEventListener('click', function () { box.style.display = 'none'; });
      document.body.appendChild(box);
    }
    box.style.display = 'block';
    box.textContent = lines.join('\n') + '\n(tap to hide)';
  }
  function log(msg) {
    lines.push(String(msg).slice(0, 300));
    if (lines.length > 25) lines.shift();
    render();
  }
  document.addEventListener('DOMContentLoaded', render);

  var cap = window.Capacitor;
  var SaveFile = null;
  var route = 'none';
  if (cap && typeof cap.registerPlugin === 'function') {
    try { SaveFile = cap.registerPlugin('SaveFile'); route = 'registerPlugin'; } catch (e) {}
  }
  if (!SaveFile && cap && cap.Plugins && cap.Plugins.SaveFile) {
    SaveFile = cap.Plugins.SaveFile;
    route = 'Plugins';
  }
  if (!SaveFile && cap && typeof cap.nativePromise === 'function') {
    SaveFile = { save: function (opts) { return cap.nativePromise('SaveFile', 'save', opts); } };
    route = 'nativePromise';
  }
  log('save helper v3 loaded | Capacitor: ' + (cap ? 'yes' : 'NO') + ' | route: ' + route);
  if (cap) log('Capacitor has: ' + Object.keys(cap).join(', '));
  try { delete window.showSaveFilePicker; } catch (e) {}

  var blobs = {};
  var origCreate = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    var url = origCreate.call(URL, obj);
    if (obj instanceof Blob) blobs[url] = obj;
    return url;
  };

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function handle(a, how) {
    var href = a.href || '';
    var hasDl = a.hasAttribute('download');
    if (hasDl) log('download link via ' + how + ': ' + (a.getAttribute('download') || '') + ' | ' + href.slice(0, 25));
    var isFile = href.indexOf('blob:') === 0 || href.indexOf('data:') === 0;
    if (!hasDl || !isFile) return false;
    if (!SaveFile) { log('cannot save: native plugin missing'); return false; }
    var name = a.getAttribute('download') || 'file';
    var getBlob = blobs[href]
      ? Promise.resolve(blobs[href])
      : fetch(href).then(function (r) { return r.blob(); });
    delete blobs[href];
    getBlob.then(toBase64).then(function (b64) {
      log('sending ' + name + ' (' + b64.length + ' chars) to Android');
      return SaveFile.save({ name: name, data: b64 });
    }).then(function (res) {
      log('Android replied: ' + JSON.stringify(res));
    }).catch(function (e) {
      log('SAVE ERROR: ' + (e && e.message ? e.message : JSON.stringify(e)));
    });
    return true;
  }

  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (handle(this, 'click()')) return;
    return origClick.apply(this, arguments);
  };
  var origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && this instanceof HTMLAnchorElement && handle(this, 'dispatchEvent')) return true;
    return origDispatch.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a && a.hasAttribute('download') && handle(a, 'tap')) e.preventDefault();
  }, true);

  window.addEventListener('error', function (e) { log('JS error: ' + e.message); });
})();
