// ═══════════════════════════════════════════════
// EKOYINI MOBILE BAR — Global script.js
// Shared utilities across all pages
// ═══════════════════════════════════════════════

// Cart utilities
const EkoyiniCart = {
      get() { return JSON.parse(localStorage.getItem('ekoyini_cart') || '{}'); },
        save(cart) { localStorage.setItem('ekoyini_cart', JSON.stringify(cart)); },
          count() { return Object.values(this.get()).reduce((a,b)=>a+b,0); },
            clear() { localStorage.removeItem('ekoyini_cart'); }
};

// Address utilities
const EkoyiniAddress = {
      get() { return localStorage.getItem('ekoyini_address') || ''; },
        save(v) { localStorage.setItem('ekoyini_address', v); }
};

// Price overrides
const EkoyiniPrices = {
      get() { return JSON.parse(localStorage.getItem('ekoyini_prices') || '{}'); },
        set(id, price) {
                const p = this.get(); p[id] = price;
                    localStorage.setItem('ekoyini_prices', JSON.stringify(p));
        },
          getFor(product) {
                  const overrides = this.get();
                      return overrides[product.id] !== undefined ? overrides[product.id] : product.price;
          }
};

// Toast
function showToast(msg, duration = 2000) {
      let t = document.getElementById('toastEl');
        if (!t) { t = document.createElement('div'); t.id='toastEl'; t.className='toast'; document.body.appendChild(t); }
          t.textContent = msg; t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), duration);
}

}
          }
        }
}
}
}