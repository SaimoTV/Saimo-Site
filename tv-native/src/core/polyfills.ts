/**
 * Polyfills para navegadores antigos de Smart TVs (webOS 3.x Chrome 38, webOS 4.x Chrome 53, Tizen 3/4).
 * Carregado antes de qualquer módulo da aplicação.
 */

(function () {
  var g: any = typeof globalThis !== 'undefined' ? globalThis : window;

  if (!Array.prototype.includes) {
    Array.prototype.includes = function (search: any, fromIndex?: number): boolean {
      var len = this.length >>> 0;
      if (len === 0) return false;
      var n = fromIndex ? fromIndex | 0 : 0;
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
      while (k < len) {
        if (this[k] === search || (search !== search && this[k] !== this[k])) return true;
        k++;
      }
      return false;
    };
  }

  if (!String.prototype.includes) {
    String.prototype.includes = function (search: string, start?: number): boolean {
      if (typeof start !== 'number') start = 0;
      if (start + search.length > this.length) return false;
      return this.indexOf(search, start) !== -1;
    };
  }

  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (search: string, pos?: number): boolean {
      var p = !pos || pos < 0 ? 0 : +pos;
      return this.substring(p, p + search.length) === search;
    };
  }

  if (!String.prototype.endsWith) {
    String.prototype.endsWith = function (search: string, thisLen?: number): boolean {
      var len = thisLen === undefined || thisLen > this.length ? this.length : thisLen;
      return this.substring(len - search.length, len) === search;
    };
  }

  if (!Object.entries) {
    Object.entries = function (obj: any): [string, any][] {
      var ownProps = Object.keys(obj);
      var i = ownProps.length;
      var resArray = new Array(i);
      while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];
      return resArray;
    };
  }

  if (!Object.values) {
    Object.values = function (obj: any): any[] {
      var ownProps = Object.keys(obj);
      var i = ownProps.length;
      var resArray = new Array(i);
      while (i--) resArray[i] = obj[ownProps[i]];
      return resArray;
    };
  }

  if (typeof Element !== 'undefined') {
    if (!Element.prototype.matches) {
      Element.prototype.matches =
        (Element.prototype as any).msMatchesSelector ||
        (Element.prototype as any).webkitMatchesSelector ||
        function (this: Element, s: string) {
          var matches = (this.document || this.ownerDocument).querySelectorAll(s);
          var i = matches.length;
          while (--i >= 0 && matches.item(i) !== this) {}
          return i > -1;
        };
    }
    if (!Element.prototype.closest) {
      Element.prototype.closest = function (this: Element, s: string): Element | null {
        var el: Element | null = this;
        do {
          if (el.matches(s)) return el;
          el = el.parentElement || (el.parentNode as Element | null);
        } while (el !== null && el.nodeType === 1);
        return null;
      };
    }
  }

  if (typeof g.CustomEvent !== 'function') {
    var CustomEventPoly = function (event: string, params?: CustomEventInit) {
      params = params || { bubbles: false, cancelable: false, detail: null };
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(event, !!params.bubbles, !!params.cancelable, params.detail);
      return evt;
    };
    CustomEventPoly.prototype = g.Event ? g.Event.prototype : {};
    g.CustomEvent = CustomEventPoly;
  }

  if (typeof g.AbortController === 'undefined') {
    g.AbortController = function (this: any) {
      var listeners: Function[] = [];
      this.signal = {
        aborted: false,
        addEventListener: function (_: string, fn: Function) {
          listeners.push(fn);
        },
        removeEventListener: function (_: string, fn: Function) {
          listeners = listeners.filter(function (f) {
            return f !== fn;
          });
        },
      };
      this.abort = function () {
        if (this.signal.aborted) return;
        this.signal.aborted = true;
        listeners.slice().forEach(function (fn) {
          try {
            fn();
          } catch {}
        });
      };
    };
  }

  if (typeof g.fetch === 'undefined') {
    g.fetch = function (input: string | Request, init?: RequestInit): Promise<any> {
      var url = typeof input === 'string' ? input : input.url;
      var opts = init || {};
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open((opts.method || 'GET').toUpperCase(), url, true);
        if (opts.headers) {
          var hdrs = opts.headers as Record<string, string>;
          Object.keys(hdrs).forEach(function (k) {
            xhr.setRequestHeader(k, hdrs[k]);
          });
        }
        var onAbort = function () {
          xhr.abort();
          reject(new Error('Aborted'));
        };
        if (opts.signal) {
          if (opts.signal.aborted) {
            reject(new Error('Aborted'));
            return;
          }
          opts.signal.addEventListener('abort', onAbort);
        }
        xhr.onload = function () {
          var status = xhr.status === 0 ? 200 : xhr.status;
          var text = xhr.responseText || '';
          resolve({
            ok: status >= 200 && status < 300,
            status: status,
            statusText: xhr.statusText || '',
            url: xhr.responseURL || url,
            headers: {
              get: function (name: string) {
                return xhr.getResponseHeader(name);
              },
            },
            text: function () {
              return Promise.resolve(text);
            },
            json: function () {
              try {
                return Promise.resolve(JSON.parse(text));
              } catch (e) {
                return Promise.reject(e);
              }
            },
          });
        };
        xhr.onerror = function () {
          reject(new Error('Network request failed'));
        };
        xhr.ontimeout = function () {
          reject(new Error('Network timeout'));
        };
        xhr.send((opts.body as any) || null);
      });
    };
  }
})();
