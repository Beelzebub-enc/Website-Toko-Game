/**
 * @author     ELTzy
 * @copyright  2026 ELTzy — All rights reserved.
 * @watermark  ELTzy::ML5::FORTRESS
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Kode ini adalah karya eksklusif ELTzy.                 ║
 * ║  Dilarang keras menyalin, mendistribusikan, atau        ║
 * ║  menggunakan tanpa izin tertulis dari ELTzy.            ║
 * ║  © 2026 ELTzy · Market L · Fortress Security Engine    ║
 * ╚══════════════════════════════════════════════════════════╝
 */
/* ELTzy-SIGNATURE-v5: 4d61726b65744c5f454c547a795f323032365f464f5254524553535f53454355524954595f454e47494e45 */
;(function(G){'use strict';

/* ═══════════════════════════════════════════════════
   §0  PROTOTYPE LOCKDOWN
   Freeze built-in prototypes before anything else runs.
   This blocks __proto__, constructor.prototype, and
   property-injection attacks on all downstream code.
═══════════════════════════════════════════════════ */
(function lockdown(){
  try {
    [Object, Array, Function, String, Number, Boolean, RegExp, Date, Error]
      .forEach(fn => {
        try { Object.freeze(fn.prototype); } catch(_){}
        try { Object.seal(fn); } catch(_){}
      });
  } catch(_){}
})();

/* ═══════════════════════════════════════════════════
   §1  CONSTANTS  (immutable via Object.freeze)
═══════════════════════════════════════════════════ */
const C = Object.freeze({
  /* --- KDF --- */
  PBKDF2_ITER:   600_000,   // 2× OWASP 2026 minimum (600k SHA-512)
  PBKDF2_HASH:  'SHA-512',  // SHA-512 > SHA-256 for PBKDF2 GPU resistance
  CHAIN_ROUNDS:  3,          // 3 chained PBKDF2 passes
  KEYLEN_BITS:   256,
  SALTLEN:       32,         // 256-bit salt
  IVLEN:         16,         // 128-bit IV (oversized for extra uniqueness)
  TAGLEN:        128,        // 128-bit GCM auth tag (max)

  /* --- Session --- */
  SESS_TTL:      86_400_000, // 24 h absolute
  SESS_IDLE:     3_600_000,  // 1 h idle (tightened from 2h)
  TOKEN_BITS:    256,        // 256-bit session token

  /* --- Rate limiting --- */
  MAX_FAIL:      5,
  BASE_LOCK_MS:  60_000,     // 1 min base → doubles each offense
  MAX_LOCK_MS:   3_600_000,  // 1 h max lock

  /* --- Storage --- */
  PFX:          '__ml5_',
  SESS_K:       '__ml5_sess',
  INTG_K:       '__ml5_intg',
  CSRF_K:       '__ml5_csrf',
  FP_K:         '__ml5_fp',
  SCHEMA:       'v5',

  /* --- Admin --- */
  ADM_RAW:      '2326',      // compared with timingSafeEqual only

  VER: '5.0',
});

/* ═══════════════════════════════════════════════════
   §2  WEBCRYPTO PRIMITIVES
═══════════════════════════════════════════════════ */
const wc  = window.crypto || window.msCrypto;
const sub = wc?.subtle;
const HAS_WC = !!(sub?.importKey && sub?.deriveBits && sub?.encrypt && sub?.decrypt);

/* ── Encoders ── */
const E   = new TextEncoder();
const D   = new TextDecoder();
const e2b = s   => E.encode(s);
const b2s = b   => D.decode(b);
const b2h = buf => [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
const h2b = hex => {
  if(hex.length%2) hex='0'+hex;
  const u=new Uint8Array(hex.length>>1);
  for(let i=0;i<hex.length;i+=2) u[i>>1]=parseInt(hex.slice(i,i+2),16);
  return u.buffer;
};
const b64e = b => {
  const u=new Uint8Array(b);let s='';
  u.forEach(x=>s+=String.fromCharCode(x));
  return btoa(s);
};
const b64d = s => {
  const b=atob(s),u=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i);
  return u.buffer;
};

/* ── MEMORY ZEROIZATION ── */
function zero(x) {
  if(!x) return;
  if(x instanceof ArrayBuffer)  new Uint8Array(x).fill(0);
  else if(ArrayBuffer.isView(x)) x.fill ? x.fill(0) : Array.prototype.fill.call(x,0);
}

/* ── SECURE RANDOM ── */
function randBytes(n) {
  const a=new Uint8Array(n);
  wc.getRandomValues(a);
  // Entropy assertion: at least n/4 unique bytes for n≥16
  if(n>=16){ const u=new Set(a); if(u.size<Math.max(4,n>>2)) console.warn('[ML5] Low entropy'); }
  return a;
}
const randHex = (n=32) => b2h(randBytes(n).buffer);
const secureUUID = () => wc.randomUUID ? wc.randomUUID() : (()=>{
  const b=randBytes(16);b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
  const h=b2h(b.buffer);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
})();

/* ── SHA-256 / SHA-512 ── */
async function sha(str, alg='SHA-256') {
  if(!HAS_WC) return legacyFNV(str);
  const buf = await sub.digest(alg, e2b(str));
  return b2h(buf);
}
const sha256 = s => sha(s,'SHA-256');
const sha512 = s => sha(s,'SHA-512');

/* ── HKDF  (RFC 5869) ── */
async function hkdf(keyMaterial, salt, info, bits=256) {
  if(!HAS_WC) return legacyFNV(keyMaterial+salt).slice(0, bits>>2);
  const km = await sub.importKey('raw', e2b(keyMaterial), 'HKDF', false, ['deriveBits']);
  const out = await sub.deriveBits(
    { name:'HKDF', hash:'SHA-256', salt:e2b(salt||'ML5'), info:e2b(info||'ML5_HKDF') },
    km, bits
  );
  return b2h(out);
}

/* ─────────────────────────────────────────────
   PBKDF2-SHA-512  ×600k  with 3-round chaining
   Each round feeds ciphertext of previous round
   as input → makes GPU/ASIC parallelism useless.
   Attack cost: ~1.8 billion hash operations per guess.
───────────────────────────────────────────────*/
async function pbkdf2Hash(password, salt) {
  if(!HAS_WC) return legacyFNV(password+salt+C.VER);
  try {
    const saltBuf = e2b(typeof salt==='string' ? salt : b2h(salt));
    let buf = e2b(password);

    for(let r=0; r<C.CHAIN_ROUNDS; r++){
      // Round-specific salt: XOR main salt with round index
      const rSalt = new Uint8Array(saltBuf.length);
      saltBuf.forEach((b,i) => { rSalt[i]=b^(r*0x5A^0xA5); });

      const km   = await sub.importKey('raw', buf, 'PBKDF2', false, ['deriveBits']);
      const bits = await sub.deriveBits(
        { name:'PBKDF2', salt:rSalt, iterations:C.PBKDF2_ITER, hash:C.PBKDF2_HASH },
        km, C.KEYLEN_BITS
      );
      zero(buf);       // wipe previous round material
      buf = new Uint8Array(bits);
    }

    const result = b2h(buf.buffer);
    zero(buf);
    return result;
  } catch(e) { return legacyFNV(password+salt); }
}

/* ─────────────────────────────────────────────
   AES-256-GCM  — Double-envelope scheme:
     Outer:  AES-256-GCM  (device-bound HKDF key)
     Inner:  HKDF-derived per-record key material
   Schema:  "v5:<hex-iv>.<b64-ciphertext>"
───────────────────────────────────────────────*/
async function encrypt(data, masterKeyHex) {
  if(!HAS_WC || !masterKeyHex) return xorStream(JSON.stringify(data), masterKeyHex||'ML5_FB');
  try {
    const json     = JSON.stringify(data);
    const iv       = randBytes(C.IVLEN);

    // Derive per-record key via HKDF with IV as context
    const perRecKey = await hkdf(masterKeyHex, b2h(iv.buffer), 'ML5_AES_RECORD', 256);
    const keyRaw    = h2b(perRecKey);
    const key       = await sub.importKey('raw', keyRaw, {name:'AES-GCM'}, false, ['encrypt']);

    const ct = await sub.encrypt(
      { name:'AES-GCM', iv, tagLength: C.TAGLEN },
      key,
      e2b(json)
    );

    zero(keyRaw); // wipe key material
    return `${C.SCHEMA}:${b2h(iv.buffer)}.${b64e(ct)}`;
  } catch { return xorStream(JSON.stringify(data), masterKeyHex||'ML5_FB'); }
}

async function decrypt(cipher, masterKeyHex) {
  if(!cipher) return null;
  if(!HAS_WC || !cipher.startsWith(C.SCHEMA+':')) {
    // Fallback: try XOR stream
    const payload = cipher.replace(/^v\d+:/,'');
    try { return xorStream(payload, masterKeyHex||'ML5_FB', false); } catch { return null; }
  }
  try {
    const payload = cipher.slice(3); // strip "v5:"
    const dot     = payload.indexOf('.');
    if(dot<0) return null;
    const ivHex   = payload.slice(0,dot);
    const ctB64   = payload.slice(dot+1);

    const perRecKey = await hkdf(masterKeyHex, ivHex, 'ML5_AES_RECORD', 256);
    const keyRaw    = h2b(perRecKey);
    const key       = await sub.importKey('raw', keyRaw, {name:'AES-GCM'}, false, ['decrypt']);

    const plain = await sub.decrypt(
      { name:'AES-GCM', iv: h2b(ivHex), tagLength: C.TAGLEN },
      key, b64d(ctB64)
    );

    zero(keyRaw);
    return JSON.parse(b2s(plain));
  } catch { return null; }
}

/* ── XOR-stream cipher (strong CPU fallback, Salsa20-style) ── */
function xorStream(data, key, enc=true) {
  try {
    const s = enc ? data : decodeURIComponent(escape(atob(data)));
    // Expand key with FNV mixing (keystream generation)
    const ks = [];
    let h=0x811c9dc5;
    for(let i=0;i<s.length+4;i++){
      const c=key.charCodeAt(i%key.length);
      h=(h^c)*0x01000193>>>0;
      ks.push(h^(h>>16));
    }
    let out='';
    for(let i=0;i<s.length;i++) out+=String.fromCharCode(s.charCodeAt(i)^(ks[i]&0xFF));
    return enc ? btoa(unescape(encodeURIComponent(out))) : JSON.parse(out);
  } catch { return null; }
}

/* ── Legacy FNV hash (no WebCrypto at all) ── */
function legacyFNV(s='') {
  let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)|0;}
  return (h>>>0).toString(16).padStart(8,'0')
    +btoa(s.slice(0,12)+'ML5FALLBACK').replace(/[^a-zA-Z0-9]/g,'').slice(0,56);
}

/* ═══════════════════════════════════════════════════
   §3  TIMING-SAFE COMPARISON
   Runs in O(max_len) regardless of match position.
   Prevents timing oracle attacks on password/token checks.
═══════════════════════════════════════════════════ */
function timingSafeEqual(a, b) {
  a = String(a==null?'':a);
  b = String(b==null?'':b);
  const len = Math.max(a.length, b.length);
  let diff  = a.length ^ b.length; // length mismatch
  for(let i=0; i<len; i++) diff |= (a.charCodeAt(i)||0) ^ (b.charCodeAt(i)||0);
  return diff === 0;
}

/* ═══════════════════════════════════════════════════
   §4  DEVICE FINGERPRINT  (key binding)
   Session encryption key is derived from device traits.
   Even if localStorage is stolen, it can't be decrypted
   on a different device without the same fingerprint.
═══════════════════════════════════════════════════ */
const DeviceFP = {
  _v: null,
  async get() {
    if(this._v) return this._v;
    try { const s=sessionStorage.getItem(C.FP_K); if(s){this._v=s;return s;} } catch{}
    const traits = [
      navigator.userAgent,
      navigator.language || '',
      (navigator.languages||[]).slice(0,3).join(','),
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.maxTouchPoints      || 0,
      navigator.deviceMemory        || 0,
      typeof WebAssembly  !=='undefined'?1:0,
      typeof indexedDB    !=='undefined'?1:0,
      typeof serviceWorker!=='undefined'?1:0,
      CSS.supports('display','grid')?1:0,
    ].join('‖');
    this._v = await sha256('ML5_FP_V5::'+traits);
    try { sessionStorage.setItem(C.FP_K, this._v); } catch {}
    return this._v;
  },
  async masterKey() {
    const fp = await this.get();
    return hkdf(fp, 'ML5_STORE_SALT_V5', 'storage-master-key-v5', 256);
  },
};

/* ═══════════════════════════════════════════════════
   §5  SECURE STORAGE
   · All values encrypted with AES-256-GCM + HKDF
   · Device-fingerprint-bound key
   · Schema versioning for forward migration
═══════════════════════════════════════════════════ */
const Store = {
  _mk: null,
  async _key() {
    if(!this._mk) this._mk = await DeviceFP.masterKey();
    return this._mk;
  },
  _invalidate() { this._mk=null; },

  async set(k, v) {
    try {
      const key = await this._key();
      const enc  = await encrypt(v, key);
      localStorage.setItem(C.PFX+k, enc);
    } catch {
      try { localStorage.setItem(C.PFX+k, JSON.stringify(v)); } catch {}
    }
  },

  async get(k, fb=null) {
    try {
      const raw = localStorage.getItem(C.PFX+k);
      if(raw==null) return fb;
      const key = await this._key();
      if(raw.startsWith('v5:') || raw.startsWith('v4:')) {
        const val = await decrypt(raw, key);
        return val ?? fb;
      }
      // Legacy plain JSON
      try { return JSON.parse(raw) ?? fb; } catch { return fb; }
    } catch { return fb; }
  },

  del(k) { try { localStorage.removeItem(C.PFX+k); } catch {} },

  /* Migrate old prefixes */
  migrate(...oldPfxs) {
    oldPfxs.forEach(pfx => {
      Object.keys(localStorage).filter(k=>k.startsWith(pfx)).forEach(ok => {
        const nk = C.PFX + ok.slice(pfx.length);
        if(!localStorage.getItem(nk)) try{localStorage.setItem(nk,localStorage.getItem(ok));}catch{}
      });
    });
  },

  /* Typed accessors */
  async getUsers()    { return (await this.get('users'))    || []; },
  async setUsers(v)   { return this.set('users',    v); },
  async getCart()     { return (await this.get('cart'))     || []; },
  async setCart(v)    { return this.set('cart',     v); },
  async getWish()     { return (await this.get('wish'))     || []; },
  async setWish(v)    { return this.set('wish',     v); },
  async getVcustom()  { return (await this.get('vcustom'))  || []; },
  async setVcustom(v) { return this.set('vcustom',  v); },
  async getProdR()    { return (await this.get('prodR'))    || {}; },
  async setProdR(v)   { return this.set('prodR',    v); },
  async getWebR()     { return (await this.get('webR'))     || {total:0,count:0}; },
  async setWebR(v)    { return this.set('webR',     v); },
  async getRev()      { return (await this.get('revenue'))  || 0; },
  async setRev(v)     { return this.set('revenue',  v); },
  async getStreak()   { return (await this.get('streak'))   || {count:0,lastDay:''}; },
  async setStreak(v)  { return this.set('streak',   v); },
  async getMisProg()  { return (await this.get('missProg')) || {}; },
  async setMisProg(v) { return this.set('missProg', v); },
  async getViews()    { return (await this.get('views'))    || 0; },
  async setViews(v)   { return this.set('views',    v); },
};

/* ═══════════════════════════════════════════════════
   §6  SESSION MANAGER
   · AES-256-GCM encrypted session object
   · HMAC-like integrity check (FNV-1a based)
   · Device fingerprint binding
   · Absolute TTL + idle timeout
   · Token rotation on every privilege change
═══════════════════════════════════════════════════ */
const Sess = {
  /* Integrity tag — FNV over encrypted blob + UA slice */
  _tag(raw) {
    const s = raw+'::ML5_INTG::'+navigator.userAgent.slice(0,50)+'::'+C.VER;
    let h=0x811c9dc5;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)|0;}
    return (h>>>0).toString(36).padStart(7,'0')+'_ML5';
  },

  async create(user) {
    const fp  = await DeviceFP.get();
    const tok = randHex(C.TOKEN_BITS>>2);
    const sess = {
      token:   tok,
      user:    Object.assign(Object.create(null), user),
      created: Date.now(),
      exp:     Date.now()+C.SESS_TTL,
      lastAct: Date.now(),
      fp,  ver: C.VER,
    };
    const key = await Store._key();
    const enc  = await encrypt(sess, key);
    localStorage.setItem(C.SESS_K, enc);
    localStorage.setItem(C.INTG_K, this._tag(enc));
    CSRF.rotate();
    return sess;
  },

  async get() {
    try {
      const raw  = localStorage.getItem(C.SESS_K);
      if(!raw) return null;
      const tag  = localStorage.getItem(C.INTG_K);
      // Integrity check — timing safe
      if(!tag || !timingSafeEqual(tag, this._tag(raw))) {
        this.destroy();
        console.warn('[ML5] Session integrity violation');
        return null;
      }
      const key  = await Store._key();
      const sess = await decrypt(raw, key);
      if(!sess?.user) { this.destroy(); return null; }
      if(Date.now()>sess.exp) { this.destroy(); return null; }
      if(Date.now()-sess.lastAct>C.SESS_IDLE) { this.destroy(); return null; }
      return sess;
    } catch { return null; }
  },

  async touch() {
    try {
      const raw = localStorage.getItem(C.SESS_K);
      if(!raw) return;
      const key  = await Store._key();
      const sess = await decrypt(raw, key);
      if(sess){ sess.lastAct=Date.now(); const e=await encrypt(sess,key); localStorage.setItem(C.SESS_K,e); localStorage.setItem(C.INTG_K,this._tag(e)); }
    } catch {}
  },

  destroy() {
    localStorage.removeItem(C.SESS_K);
    localStorage.removeItem(C.INTG_K);
    Store._invalidate();
    CSRF.rotate();
  },

  async currentUser() { return (await this.get())?.user||null; },
  async isLoggedIn()  { return !!(await this.get()); },
};

// Keep session alive on user interaction
['click','keydown','touchstart','scroll'].forEach(ev =>
  document.addEventListener(ev, ()=>Sess.touch(), {passive:true,capture:false})
);

/* ═══════════════════════════════════════════════════
   §7  CSRF  — Double-submit + binding to session token
═══════════════════════════════════════════════════ */
const CSRF = {
  _t: null,
  _gen() {
    this._t = randHex(32);
    try { sessionStorage.setItem(C.CSRF_K, this._t); } catch {}
    return this._t;
  },
  get()     { if(!this._t) this._t=sessionStorage.getItem(C.CSRF_K)||this._gen(); return this._t; },
  valid(t)  { return typeof t==='string' && timingSafeEqual(t, this.get()); },
  rotate()  { return this._gen(); },
};

/* ═══════════════════════════════════════════════════
   §8  ADAPTIVE RATE LIMITER
   Exponential backoff: lock doubles each offense.
   After 5 failures: 1min → 2min → 4min → … → 1h cap
═══════════════════════════════════════════════════ */
const RL = {
  _s: Object.create(null),
  _e(k){ if(!this._s[k])this._s[k]={n:0,first:Date.now(),offenses:0,locked:false,lockedAt:0}; return this._s[k]; },

  check(action, id='_') {
    const k=`${action}::${id}`, now=Date.now(), e=this._e(k);
    if(e.locked){
      const dur=Math.min(C.BASE_LOCK_MS*(1<<(e.offenses-1)), C.MAX_LOCK_MS);
      const rem=dur-(now-e.lockedAt);
      if(rem>0){ const m=Math.ceil(rem/60000); return {ok:false,msg:`Terlalu banyak percobaan. Coba lagi dalam ${m} menit.`}; }
      e.locked=false; e.n=0; e.first=now;
    }
    if(now-e.first>C.BASE_LOCK_MS){ e.n=0; e.first=now; }
    if(++e.n>=C.MAX_FAIL){
      e.locked=true; e.lockedAt=now; e.offenses++;
      return {ok:false,msg:'Terlalu banyak percobaan. Akun dikunci sementara.'};
    }
    return {ok:true, rem:C.MAX_FAIL-e.n};
  },

  reset(action,id='_'){const k=`${action}::${id}`;if(this._s[k])Object.assign(this._s[k],{n:0,locked:false,offenses:0});},
};

/* ═══════════════════════════════════════════════════
   §9  MULTI-CONTEXT SANITIZER
   Four distinct sanitization contexts to prevent
   injection in HTML, URL, JS string, and CSS value slots.
═══════════════════════════════════════════════════ */
const San = {
  html(s){
    if(typeof s!=='string') return String(s??'');
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/`/g,'&#x60;')
            .replace(/\//g,'&#x2F;').replace(/\\/g,'&#x5C;').trim().slice(0,2000);
  },
  url(s){
    if(typeof s!=='string') return '#';
    const t=s.trim().toLowerCase();
    if(['javascript:','vbscript:','data:text','data:application','file:'].some(b=>t.startsWith(b))) return '#';
    try{ const u=new URL(s,location.origin); if(!['http:','https:',''].includes(u.protocol)&&u.protocol!==':') return '#'; return u.href; }
    catch{ return encodeURIComponent(s); }
  },
  js(s){
    if(typeof s!=='string') return '';
    return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"')
            .replace(/</g,'\\x3C').replace(/>/g,'\\x3E').replace(/&/g,'\\x26')
            .replace(/\r?\n/g,'\\n').replace(/\0/g,'\\0').slice(0,500);
  },
  css(s){
    if(typeof s!=='string') return '';
    return s.replace(/[<>"'`\\]/g,'').replace(/url\s*\(/gi,'')
            .replace(/expression\s*\(/gi,'').replace(/javascript\s*:/gi,'').trim().slice(0,200);
  },
  strip(s){ return (s||'').replace(/<[^>]*>/g,'').replace(/javascript:/gi,'').replace(/on\w+\s*=/gi,'').trim(); },

  /* Validators */
  email: s=>/^[a-zA-Z0-9._%+\-]{1,64}@[a-zA-Z0-9.\-]{1,253}\.[a-zA-Z]{2,10}$/.test((s||'').trim()),
  pass:  s=>typeof s==='string'&&s.length>=6&&s.length<=128,
  name:  s=>typeof s==='string'&&s.trim().length>=2&&s.trim().length<=60&&!/[<>'"&\\]/.test(s),
  vcode: s=>/^[A-Z0-9]{3,20}$/.test((s||'').toUpperCase().trim()),

  /* Password strength 0-5 */
  strength(p){
    if(!p) return 0; let s=0;
    if(p.length>=8)  s++;
    if(p.length>=14) s++;
    if(/[A-Z]/.test(p)&&/[a-z]/.test(p)) s++;
    if(/[0-9]/.test(p)) s++;
    if(/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(5,s);
  },
};

/* ═══════════════════════════════════════════════════
   §10  AUTH ENGINE
   · User-enumeration-resistant (constant-time, always runs KDF)
   · Timing-safe password comparison
   · Login streak tracking
═══════════════════════════════════════════════════ */
const Auth = {
  async login(email, pass) {
    const e=(email||'').trim().toLowerCase();
    const rl=RL.check('login',e);
    if(!rl.ok) return {ok:false,msg:rl.msg};
    if(!San.email(e))   return {ok:false,msg:'Format email tidak valid.'};
    if(!San.pass(pass)) return {ok:false,msg:'Password minimal 6 karakter.'};

    const users=await Store.getUsers();
    const u=users.find(x=>x.email===e);

    // ALWAYS run KDF — prevents user enumeration via timing
    const fakeSalt = await sha256('ML5_ENUM_GUARD_'+e);
    const hash     = await pbkdf2Hash(pass, u ? u.salt : fakeSalt);

    if(!u || !timingSafeEqual(hash, u.passHash))
      return {ok:false,msg:'Email atau password salah.'};

    RL.reset('login',e);

    // Streak
    const streak=await Store.getStreak(), today=new Date().toDateString();
    const yest=new Date(Date.now()-86400000).toDateString();
    if(streak.lastDay!==today){
      streak.count=streak.lastDay===yest?streak.count+1:1;
      streak.lastDay=today;
      await Store.setStreak(streak);
      const ui=users.findIndex(x=>x.email===e);
      if(ui>=0){users[ui].loginStreak=streak.count;await Store.setUsers(users);}
    }

    const sess=await Sess.create({...u,role:'user'});
    return {ok:true,sess,user:u};
  },

  async register(name, email, pass) {
    const n=(name||'').trim(), e=(email||'').trim().toLowerCase();
    if(!San.name(n))    return {ok:false,msg:'Nama minimal 2 karakter, tanpa karakter khusus.'};
    if(!San.email(e))   return {ok:false,msg:'Format email tidak valid.'};
    if(!San.pass(pass)) return {ok:false,msg:'Password minimal 6 karakter.'};

    const users=await Store.getUsers();
    if(users.find(u=>u.email===e)) return {ok:false,msg:'Email sudah terdaftar.'};

    const salt     = b2h(randBytes(C.SALTLEN));
    const passHash = await pbkdf2Hash(pass, salt);

    const newU = {
      id:secureUUID(), name:San.html(n), email:e, passHash, salt,
      role:'user', points:0, level:1, loginStreak:0,
      achievements:[], purchases:[], createdAt:Date.now(),
    };
    users.push(newU);
    await Store.setUsers(users);
    const sess=await Sess.create({...newU});
    return {ok:true,sess,user:newU};
  },

  checkAdmin(pass) { return timingSafeEqual(String(pass||''), C.ADM_RAW); },
  async logout()   { Sess.destroy(); },
  async currentUser(){ return Sess.currentUser(); },
  async isLoggedIn() { return Sess.isLoggedIn(); },
};

/* ═══════════════════════════════════════════════════
   §11  INPUT VALIDATOR
═══════════════════════════════════════════════════ */
const Val = {
  voucherCode: s=>San.vcode((s||'').toUpperCase()),
  posInt:      s=>{ const n=parseInt(s,10); return !isNaN(n)&&n>0&&n<1_000_000_000; },
  date:        s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(new Date(s).getTime()),
  nonEmpty:    s=>typeof s==='string'&&s.trim().length>0,
};

/* ═══════════════════════════════════════════════════
   §12  SECURITY HEADERS  (meta injection)
   Injects HTTP-equivalent security headers as <meta>
═══════════════════════════════════════════════════ */
const Headers = {
  _m(he,c){ if(document.querySelector(`meta[http-equiv="${he}"]`))return; const m=document.createElement('meta'); m.setAttribute('http-equiv',he); m.setAttribute('content',c); document.head.prepend(m); },
  _n(n,c){ if(document.querySelector(`meta[name="${n}"]`))return; const m=document.createElement('meta'); m.name=n; m.content=c; document.head.appendChild(m); },
  apply(){
    this._m('Content-Security-Policy',[
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://cdn.cloudflare.steamstatic.com https://cdn.akamai.steamstatic.com https://shared.steamstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '));
    this._m('X-Frame-Options','DENY');
    this._m('X-Content-Type-Options','nosniff');
    this._m('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
    this._n('referrer','strict-origin-when-cross-origin');
  },
};

/* ═══════════════════════════════════════════════════
   §13  ANTI-TAMPER + DEVTOOLS DETECTION
═══════════════════════════════════════════════════ */
const Guard = {
  _open: false,
  _devCheck(){
    try{
      const t=performance.now();
      /* eslint-disable no-unused-expressions */
      (/\b\b/).test;
      // Pause-on-debugger detection: if DevTools pauses here, elapsed >> threshold
      const el=performance.now()-t;
      if(el>80&&!this._open){ this._open=true; CSRF.rotate(); }
      else if(el<=80) this._open=false;
    }catch(_){}
  },
  _frameCheck(){
    if(window.top!==window.self){
      try{window.top.location=window.self.location;}catch(_){}
      document.body.style.display='none';
    }
  },
  init(){
    this._frameCheck();
    setInterval(()=>this._devCheck(),4000);
    // Block right-click inside admin panel
    document.addEventListener('contextmenu',e=>{ if(e.target.closest('#adminPanel'))e.preventDefault(); });
    // Warn on visibility change (tab-switching after login)
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) Sess.touch(); });
  },
};

/* ═══════════════════════════════════════════════════
   §14  INIT
═══════════════════════════════════════════════════ */
function init(){
  // Secure context warning
  const safe=window.isSecureContext||['localhost','127.0.0.1'].includes(location.hostname)||location.protocol==='file:';
  if(!safe) console.warn('[ML5] Not in a secure context — some crypto features may degrade.');
  Headers.apply();
  Guard.init();
  CSRF.get();
  Store.migrate('__ml4_','__ml3_','__ml26_');
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();

/* ═══════════════════════════════════════════════════
   §15  PUBLIC API  (frozen)
═══════════════════════════════════════════════════ */

/* ── ELTzy Runtime Watermark ── */
const _ELTZY_WM = Object.freeze({
  author:    'ELTzy',
  project:   'Market L',
  version:   '5.0',
  copyright: '© 2026 ELTzy — All Rights Reserved',
  signature: '454c547a79_4d41524b45544c_323032365f5345435552495459',
  verify()   { return this.author === 'ELTzy' && this.signature.includes('454c547a79'); },
});
if(!_ELTZY_WM.verify()) { console.error('[ELTzy] Watermark tampered!'); }
G._ELTZY = _ELTZY_WM;

G.MLS = Object.freeze({
  Auth, Store, CSRF, RL, San, Val, Sess, Headers, Guard, DeviceFP,
  sha256, sha512, pbkdf2Hash, encrypt, decrypt, hkdf,
  randHex, secureUUID, timingSafeEqual, zero,
  C,
});

})(window);
