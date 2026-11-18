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

  // webOS 4 (Chromium 53) e Tizen antigos: sem estes, a primeira lista ou o
  // primeiro canal lido dava erro e o app ficava parado na abertura.
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (alvo: number, preencher?: string): string {
      var s = String(this);
      var p = preencher === undefined ? ' ' : String(preencher);
      if (s.length >= alvo || !p) return s;
      var falta = alvo - s.length;
      while (p.length < falta) p += p;
      return p.slice(0, falta) + s;
    };
  }
  if (!String.prototype.padEnd) {
    String.prototype.padEnd = function (alvo: number, preencher?: string): string {
      var s = String(this);
      var p = preencher === undefined ? ' ' : String(preencher);
      if (s.length >= alvo || !p) return s;
      var falta = alvo - s.length;
      while (p.length < falta) p += p;
      return s + p.slice(0, falta);
    };
  }
  if (!(String.prototype as any).trimStart) {
    (String.prototype as any).trimStart = function (this: string) { return this.replace(/^[\s\uFEFF\xA0]+/, ''); };
  }
  if (!(String.prototype as any).trimEnd) {
    (String.prototype as any).trimEnd = function (this: string) { return this.replace(/[\s\uFEFF\xA0]+$/, ''); };
  }
  if (typeof Promise !== 'undefined' && !(Promise.prototype as any).finally) {
    (Promise.prototype as any).finally = function (this: Promise<any>, fn: () => void) {
      return this.then(
        function (v) { return Promise.resolve(fn()).then(function () { return v; }); },
        function (e) { return Promise.resolve(fn()).then(function () { throw e; }); },
      );
    };
  }
  if (!(Array.prototype as any).flat) {
    (Array.prototype as any).flat = function (this: any[], prof?: number): any[] {
      var d = prof === undefined ? 1 : prof;
      var saida: any[] = [];
      (function achatar(lista: any[], n: number) {
        for (var i = 0; i < lista.length; i++) {
          if (Array.isArray(lista[i]) && n > 0) achatar(lista[i], n - 1); else saida.push(lista[i]);
        }
      })(this, d);
      return saida;
    };
  }
  if (!(Array.prototype as any).flatMap) {
    (Array.prototype as any).flatMap = function (this: any[], fn: (v: any, i: number, a: any[]) => any, este?: any): any[] {
      return (this.map(fn, este) as any).flat(1);
    };
  }
  if (!(Object as any).fromEntries) {
    (Object as any).fromEntries = function (pares: Iterable<[string, any]>): any {
      var o: any = {};
      Array.from(pares as any).forEach(function (p: any) { o[p[0]] = p[1]; });
      return o;
    };
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

  // ---- Chromium 53 (LG webOS 4.x, TVs de 2018-2019) não tem estes ----

  // Promise.prototype.finally (Chrome 63).
  if (typeof Promise !== 'undefined' && !(Promise.prototype as any).finally) {
    (Promise.prototype as any).finally = function (this: Promise<any>, fn: () => any) {
      var P: any = this.constructor || Promise;
      return this.then(
        function (v: any) { return P.resolve(fn && fn()).then(function () { return v; }); },
        function (e: any) { return P.resolve(fn && fn()).then(function () { throw e; }); },
      );
    };
  }
  if (typeof Promise !== 'undefined' && !(Promise as any).allSettled) {
    (Promise as any).allSettled = function (lista: any[]) {
      return Promise.all(Array.prototype.map.call(lista, function (p: any) {
        return Promise.resolve(p).then(
          function (value: any) { return { status: 'fulfilled', value: value }; },
          function (reason: any) { return { status: 'rejected', reason: reason }; },
        );
      }));
    };
  }

  // append, prepend, before, after, replaceWith (Chrome 54): aceitam nós e textos.
  var paraNo = function (itens: any[]): Node {
    if (itens.length === 1 && itens[0] instanceof Node) return itens[0];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < itens.length; i++) {
      var it = itens[i];
      frag.appendChild(it instanceof Node ? it : document.createTextNode(String(it)));
    }
    return frag;
  };
  var definir = function (alvo: any, nome: string, fn: Function) {
    if (alvo && !alvo[nome]) Object.defineProperty(alvo, nome, { value: fn, configurable: true, writable: true });
  };
  [typeof Element !== 'undefined' ? Element.prototype : null, typeof Document !== 'undefined' ? Document.prototype : null,
    typeof DocumentFragment !== 'undefined' ? DocumentFragment.prototype : null].forEach(function (proto: any) {
    definir(proto, 'append', function (this: Node) { this.appendChild(paraNo(Array.prototype.slice.call(arguments))); });
    definir(proto, 'prepend', function (this: Node) { this.insertBefore(paraNo(Array.prototype.slice.call(arguments)), this.firstChild); });
  });
  [typeof Element !== 'undefined' ? Element.prototype : null, typeof CharacterData !== 'undefined' ? CharacterData.prototype : null].forEach(function (proto: any) {
    definir(proto, 'before', function (this: ChildNode & Node) { if (this.parentNode) this.parentNode.insertBefore(paraNo(Array.prototype.slice.call(arguments)), this); });
    definir(proto, 'after', function (this: ChildNode & Node) { if (this.parentNode) this.parentNode.insertBefore(paraNo(Array.prototype.slice.call(arguments)), this.nextSibling); });
    definir(proto, 'replaceWith', function (this: ChildNode & Node) { if (this.parentNode) this.parentNode.replaceChild(paraNo(Array.prototype.slice.call(arguments)), this); });
    definir(proto, 'remove', function (this: ChildNode & Node) { if (this.parentNode) this.parentNode.removeChild(this); });
  });

  // Node.isConnected (Chrome 54).
  if (typeof Node !== 'undefined' && !('isConnected' in Node.prototype)) {
    Object.defineProperty(Node.prototype, 'isConnected', {
      configurable: true,
      get: function (this: Node) { return !!(this.ownerDocument && this.ownerDocument.documentElement && this.ownerDocument.documentElement.contains(this)); },
    });
  }

  // String.prototype.replaceAll (Chrome 85): só com texto (expressão regular já tem /g).
  if (!(String.prototype as any).replaceAll) {
    (String.prototype as any).replaceAll = function (this: string, de: any, para: any) {
      if (de instanceof RegExp) return this.replace(de, para);
      return this.split(String(de)).join(typeof para === 'function' ? para(String(de)) : String(para));
    };
  }

  // queueMicrotask (Chrome 71).
  if (typeof g.queueMicrotask !== 'function') {
    g.queueMicrotask = function (fn: () => void) { Promise.resolve().then(fn); };
  }

  // Flex `gap` (Chrome 84): sem ele, o sem-gap.css põe margens no lugar.
  try {
    var caixa = document.createElement('div');
    caixa.style.display = 'flex';
    caixa.style.flexDirection = 'column';
    caixa.style.position = 'absolute';
    caixa.style.visibility = 'hidden';
    (caixa.style as any).rowGap = '1px';
    caixa.appendChild(document.createElement('div'));
    caixa.appendChild(document.createElement('div'));
    (document.body || document.documentElement).appendChild(caixa);
    var temGap = caixa.scrollHeight === 1;
    caixa.parentNode && caixa.parentNode.removeChild(caixa);
    if (!temGap) document.documentElement.className += ' sem-gap';
  } catch (e) { /* sem DOM: nada a fazer */ }
})();
