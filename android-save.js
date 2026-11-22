(function () {
  var cap = window.Capacitor;
  var SaveFile = null;
  if (cap && cap.Plugins && cap.Plugins.SaveFile) {
    SaveFile = cap.Plugins.SaveFile;
  } else if (cap && typeof cap.registerPlugin === 'function') {
    try { SaveFile = cap.registerPlugin('SaveFile'); } catch (e) {}
  } else if (cap && typeof cap.nativePromise === 'function') {
    SaveFile = { save: function (opts) { return cap.nativePromise('SaveFile', 'save', opts); } };
  }
  if (!SaveFile) return;

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

  function handle(a) {
    var href = a.href || '';
    var isFile = href.indexOf('blob:') === 0 || href.indexOf('data:') === 0;
    if (!a.hasAttribute('download') || !isFile) return false;
    var name = a.getAttribute('download') || 'file';
    var getBlob = blobs[href]
      ? Promise.resolve(blobs[href])
      : fetch(href).then(function (r) { return r.blob(); });
    delete blobs[href];
    getBlob.then(toBase64).then(function (b64) {
      return SaveFile.save({ name: name, data: b64 });
    }).catch(function (e) {
      alert('Save failed: ' + (e && e.message ? e.message : JSON.stringify(e)));
    });
    return true;
  }

  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (handle(this)) return;
    return origClick.apply(this, arguments);
  };
  var origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && this instanceof HTMLAnchorElement && handle(this)) return true;
    return origDispatch.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a && a.hasAttribute('download') && handle(a)) e.preventDefault();
  }, true);
})();
