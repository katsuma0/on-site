/* The script injected into every page load, before the app's own code runs.
   It gives the web app four native abilities:
     1. navigator.share() backed by the iOS share sheet. Each file crosses
        the bridge and is rebuilt as a real file: text files (the journal
        backup) as text, anything else as base64. Cancelling the sheet
        rejects with AbortError, exactly like Safari; a file that could not
        be read or written rejects with a different error, so the web app
        tells the reader the export did not happen instead of staying quiet.
     2. Haptics through the Capacitor-style hook the app already probes
        (window.Capacitor.Plugins.Haptics), plus navigator.vibrate. The same
        window.Capacitor object is how the web app knows it runs in the app.
     3. A "standalone" signal so the web app knows it is installed and
        hides its add-to-home-screen hints.
     4. A native tab bar signal, so the page hides its own bar and reports
        its tab and sheets to the shell instead. */

import Foundation

enum NativeBridge {
    static let script = #"""
    (function () {
      'use strict';
      if (window.__onNativeBridge) { return; }
      window.__onNativeBridge = true;
      /* 4. The tab bar is the system one (TabShell.swift) */
      window.__onNativeTabs = true;

      function post(name, payload) {
        try { window.webkit.messageHandlers[name].postMessage(payload); return true; }
        catch (e) { return false; }
      }

      /* 2. Haptics, and the in-app signal */
      window.Capacitor = window.Capacitor || {
        isNativePlatform: function () { return true; },
        getPlatform: function () { return 'ios'; },
        Plugins: { Haptics: { impact: function () { post('haptic', 1); } } }
      };
      try {
        Object.defineProperty(navigator, 'vibrate', {
          value: function () { post('haptic', 1); return true; },
          configurable: true
        });
      } catch (e) {}

      /* 3. Installed-app signal */
      try {
        Object.defineProperty(navigator, 'standalone', {
          get: function () { return true; },
          configurable: true
        });
      } catch (e) {}
      try {
        var nativeMatchMedia = window.matchMedia;
        window.matchMedia = function (query) {
          if (/display-mode:\s*standalone/.test(String(query))) {
            return {
              matches: true, media: String(query), onchange: null,
              addListener: function () {}, removeListener: function () {},
              addEventListener: function () {}, removeEventListener: function () {},
              dispatchEvent: function () { return false; }
            };
          }
          return nativeMatchMedia.call(window, query);
        };
      } catch (e) {}

      /* 1. navigator.share
         ids carry a per-load random prefix so a share sheet that outlives a
         page reload can never settle a different page's pending share. */
      var seq = 0;
      var runTag = 'p' + Math.random().toString(36).slice(2, 10);
      var pending = {};
      /* a tap does not focus a <button> in WebKit (document.activeElement
         stays on the body), so the tapped control is remembered instead */
      var lastTap = null;
      document.addEventListener('click', function (ev) { lastTap = ev.target; }, true);
      function failure(message) {
        var err = new Error(message);
        err.name = 'DataError';
        return err;
      }
      window.__bridgeShareDone = function (id, status) {
        var p = pending[id];
        if (!p) { return; }
        delete pending[id];
        if (status === 'shared') { p.resolve(); return; }
        if (status === 'error') { p.reject(failure('Share failed')); return; }
        var err = new Error('Share canceled');
        err.name = 'AbortError';
        p.reject(err);
      };
      navigator.canShare = function () { return true; };
      navigator.share = function (data) {
        data = data || {};
        return new Promise(function (resolve, reject) {
          var id = runTag + '-' + (++seq);
          pending[id] = { resolve: resolve, reject: reject };
          var files = data.files || [];
          var out = [];
          var i = 0;
          function fail() {
            if (!pending[id]) { return; }
            delete pending[id];
            reject(failure('Share failed'));
          }
          /* the control that was tapped, so an iPad popover can point at it */
          function anchor() {
            try {
              var e = lastTap && lastTap.closest ? lastTap.closest('button, a, [role="button"], [tabindex]') : null;
              if (!e) { e = document.activeElement; }
              if (!e || e === document.body || e === document.documentElement || !e.getBoundingClientRect) { return null; }
              var r = e.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) { return { x: r.left, y: r.top, w: r.width, h: r.height }; }
            } catch (err) {}
            return null;
          }
          function send() {
            var sent = post('share', {
              id: id,
              title: String(data.title || ''),
              text: String(data.text || ''),
              url: String(data.url || ''),
              files: out,
              rect: anchor()
            });
            if (!sent) { fail(); }
          }
          function next() {
            if (i >= files.length) { send(); return; }
            var f = files[i++];
            var type = f.type || 'application/octet-stream';
            var asText = /^(text\/|application\/json)/.test(type);
            var reader = new FileReader();
            reader.onload = function () {
              var s = String(reader.result || '');
              var entry = { name: f.name || 'file', type: type };
              if (asText) { entry.text = s; } else { entry.data = s.slice(s.indexOf(',') + 1); }
              out.push(entry);
              next();
            };
            reader.onerror = fail;
            if (asText) { reader.readAsText(f); } else { reader.readAsDataURL(f); }
          }
          next();
        });
      };
    })();
    """#
}
