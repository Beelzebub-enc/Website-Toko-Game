/**
 * @author     ELTzy
 * @copyright  2026 ELTzy — All Rights Reserved
 * @module     checkout.js — Mega Cart Panel + Cinematic Payment Engine
 * ELTzy-SIG: 454c547a795f434845434b4f55545f454e47494e455f76382e30
 *
 * Features:
 *  - Mega 2-column cart/wishlist panel
 *  - Integrated payment method selector
 *  - Cinematic per-method payment animations
 *  - DANA: 3D phone UI + balance animation
 *  - GoPay: Holographic QR + countdown
 *  - Alfamart: Real ticket + barcode
 *  - Unique processing loaders per method
 *  - Success celebration with confetti
 */
;(function(G){'use strict';
/* ── ELTzy runtime watermark ── */
const _W='ELTzy::CHECKOUT::v8.0::2026';

/* ── Shared state ── */
let _payTotal=0, _payMethod='', _alfaCode='', _gopayTimerIv=null, _gopayTimeLeft=180;
// Robust ST accessor — works regardless of load order
function getState(){ return getState() || window.ST || {}; }

/* ════════════════════════════════════════════
   MEGA CART PANEL
════════════════════════════════════════════ */
function openCart(){
  const wrap=document.getElementById('cartSidebar');
  const ovr =document.getElementById('cartOvr');
  if(!wrap)return;
  wrap.classList.add('open');
  if(ovr){ovr.classList.add('on');}
  document.body.style.overflow='hidden';
  renderMcpCart();
  renderMcpWish();
  syncMcpBadges();
  syncMcpSummary();
}

function closeCart(){
  const wrap=document.getElementById('cartSidebar');
  const ovr =document.getElementById('cartOvr');
  if(wrap) wrap.classList.remove('open');
  if(ovr)  ovr.classList.remove('on');
  document.body.style.overflow='';
}

function mcpTab(tab){
  document.querySelectorAll('.mcp-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.mcp-panel').forEach(p=>p.classList.remove('active'));
  const panel=document.getElementById(tab==='cart'?'mcpCartPanel':'mcpWishPanel');
  if(panel){panel.classList.add('active');panel.style.animation='none';void panel.offsetWidth;panel.style.animation='';}
}

function syncMcpBadges(){
  const ST=getState()||{cart:[],wish:[]};
  const cb=document.getElementById('cartBadge2');
  const wb=document.getElementById('wishBadge2');
  if(cb) cb.textContent=ST.cart.length||'';
  if(wb) wb.textContent=ST.wish.length||'';
  // Also sync page wishlist count
  const wct=document.getElementById('wishCountTxt');
  if(wct) wct.textContent=(ST.wish.length||0)+' game';
}

function renderMcpCart(){
  const ST=getState()||{cart:[],products:[]};
  const list =document.getElementById('mcpCartList');
  const empty=document.getElementById('mcpCartEmpty');
  const panel=document.getElementById('mcpCartPanel');
  if(!list||!panel) return;
  if(!ST.cart.length){
    list.innerHTML='';
    if(empty) empty.style.display='flex';
    syncMcpSummary();
    return;
  }
  if(empty) empty.style.display='none';
  list.innerHTML=ST.cart.map((item,idx)=>{
    const p=ST.products.find(x=>x.id===item.id)||{};
    const img=p.localImage||p.steamImg||`images/${p.id}.svg`;
    const price=item.finalPrice||p.price||0;
    return `<div class="mcp-cart-item" style="animation-delay:${idx*0.05}s">
      <img class="mcp-item-thumb" src="${img||p.steamImg}" loading="lazy" alt="${MLS&&MLS.San?MLS.San.html(p.title||p.name||"Game"):""}" onerror="this.onerror=null;this.src='${(p.steamImg||"").replace(/'/g,"%27")}'" >
      <div class="mcp-item-info">
        <div class="mcp-item-name">${MLS.San.html(p.title||p.name||'Produk')}</div>
        <div class="mcp-item-plat">${MLS.San.html((p.platforms||[]).slice(0,2).join(' · '))}</div>
        <div class="mcp-item-price">${fmtRp(price)}</div>
      </div>
      <button class="mcp-item-rm" onclick="ML.mcpRemoveCart('${MLS.San.js(item.id)}')" aria-label="Hapus">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`;
  }).join('');
  syncMcpSummary();
}

function mcpRemoveCart(id){
  if(!getState()) return;
  _ST.cart=_ST.cart.filter(i=>i.id!==id);
  MLS.Store.setCart(_ST.cart);
  renderMcpCart();
  if(typeof updateCartBadge==='function') updateCartBadge();
}

function renderMcpWish(){
  const ST=getState()||{wish:[],products:[]};
  const list =document.getElementById('mcpWishList');
  const empty=document.getElementById('mcpWishEmpty');
  if(!list) return;
  const items=ST.wish.map(id=>ST.products.find(p=>p.id===id)).filter(Boolean);
  if(!items.length){
    list.innerHTML='';
    if(empty) empty.style.display='flex';
    return;
  }
  if(empty) empty.style.display='none';
  list.innerHTML=items.map((p,idx)=>{
    const img=p.localImage||p.steamImg||`images/${p.id}.svg`;
    const inCart=ST.cart.some(c=>c.id===p.id);
    return `<div class="mcp-wish-item" style="animation-delay:${idx*0.05}s">
      <img class="mcp-item-thumb" src="${img||p.steamImg}" loading="lazy" alt="${MLS&&MLS.San?MLS.San.html(p.title||p.name||"Game"):""}" onerror="this.onerror=null;this.src='${(p.steamImg||"").replace(/'/g,"%27")}'" >
      <div class="mcp-item-info">
        <div class="mcp-item-name">${MLS.San.html(p.title||p.name||'Produk')}</div>
        <div class="mcp-item-plat">${MLS.San.html((p.platforms||[]).slice(0,2).join(' · '))}</div>
        <div class="mcp-item-price">${fmtRp(p.price||0)}</div>
      </div>
      <button class="mcp-wish-add" onclick="ML.mcpWishToCart('${MLS.San.js(p.id)}')">${inCart?'✓ Di Keranjang':'+ Keranjang'}</button>
      <button class="mcp-wish-rm" onclick="ML.mcpRemoveWish('${MLS.San.js(p.id)}')" aria-label="Hapus dari wishlist">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`;
  }).join('');
  syncMcpBadges();
  // Sync wishlist page
  if(typeof renderWishPage==='function') renderWishPage();
}

function mcpWishToCart(id){
  if(!getState()) return;
  const p=_ST.products.find(x=>x.id===id);
  if(!p) return;
  if(!_ST.cart.find(c=>c.id===id)){
    _ST.cart.push({id,finalPrice:p.price});
    MLS.Store.setCart(_ST.cart);
    renderMcpCart();
  }
  renderMcpWish();
  mcpTab('cart');
  if(typeof updateCartBadge==='function') updateCartBadge();
}

function mcpRemoveWish(id){
  if(!getState()) return;
  _ST.wish=_ST.wish.filter(x=>x!==id);
  MLS.Store.setWish(_ST.wish);
  renderMcpWish();
  syncMcpBadges();
  if(typeof updateWishBadge==='function') updateWishBadge();
  if(typeof renderWishPage==='function') renderWishPage();
}

function syncMcpSummary(){
  const ST=getState()||{cart:[],products:[],appliedVoucher:null,vouchers:[]};
  const items=document.getElementById('mcpSummaryItems');
  const subEl=document.getElementById('cartSub');
  const totEl=document.getElementById('cartTot');
  const discRow=document.getElementById('cartDiscRow');
  const discEl=document.getElementById('cartDisc');

  const sub=ST.cart.reduce((s,i)=>{const p=ST.products.find(x=>x.id===i.id);return s+(i.finalPrice||p?.price||0);},0);
  let disc=0;
  if(ST.appliedVoucher){
    const v=(ST.vouchers||[]).find(x=>x.code===ST.appliedVoucher&&x.active);
    if(v&&sub>=v.minBuy) disc=v.type==='pct'?Math.min(sub*v.value/100,v.maxSave):v.value;
  }
  const total=sub-disc;

  if(items){
    if(!ST.cart.length){
      items.innerHTML='<div style="font-size:.75rem;color:var(--w30);padding:8px 0">Keranjang kosong</div>';
    } else {
      items.innerHTML=ST.cart.slice(0,5).map(ci=>{
        const p=ST.products.find(x=>x.id===ci.id)||{};
        const price=ci.finalPrice||p.price||0;
        return `<div class="mcp-sum-item">
          <span class="mcp-sum-item-name">${MLS.San.html(p.title||p.name||'Produk')}</span>
          <span class="mcp-sum-item-price">${fmtRp(price)}</span>
        </div>`;
      }).join('')+(ST.cart.length>5?`<div style="font-size:.7rem;color:var(--w30);padding:4px 0">+${ST.cart.length-5} game lainnya</div>`:'');
    }
  }
  if(subEl) subEl.textContent=fmtRp(sub);
  if(totEl) totEl.textContent=fmtRp(total);
  if(discRow) discRow.style.display=disc>0?'flex':'none';
  if(discEl)  discEl.textContent='-'+fmtRp(disc);

  const btn=document.getElementById('mcpCheckoutBtn');
  const txt=btn?.querySelector('.mcp-btn-txt');
  if(btn){
    const hasItems=ST.cart.length>0;
    const hasMeth=!!_payMethod;
    btn.disabled=!hasItems||!hasMeth;
    if(txt){
      if(!hasItems) txt.textContent='Keranjang Kosong';
      else if(!hasMeth) txt.textContent='Pilih Metode Pembayaran';
      else txt.textContent=`Bayar ${fmtRp(total)}`;
    }
  }
}

function selectMcpMethod(method){
  _payMethod=method;
  document.querySelectorAll('.mcp-pay-card').forEach(c=>{
    const sel=c.dataset.method===method;
    c.classList.toggle('selected',sel);
    // Pop animation
    if(sel){c.style.animation='none';void c.offsetWidth;c.style.animation='mcpItemIn .2s var(--ease)';}
  });
  document.querySelectorAll('[id^="radio-"]').forEach(r=>{
    r.style.borderColor=r.id==='radio-'+method?'var(--g50)':'var(--b28)';
  });
  syncMcpSummary();
}

function doMcpCheckout(){
  const ST=getState()||{};
  if(!ST.user){closeCart();if(typeof openAuth==='function')openAuth();return;}
  if(!ST.cart||!ST.cart.length){return;}
  if(!_payMethod) return;

  const sub=ST.cart.reduce((s,i)=>{const p=ST.products.find(x=>x.id===i.id);return s+(i.finalPrice||p?.price||0);},0);
  let disc=0;
  if(ST.appliedVoucher){
    const v=(ST.vouchers||[]).find(x=>x.code===ST.appliedVoucher&&x.active);
    if(v&&sub>=v.minBuy) disc=v.type==='pct'?Math.min(sub*v.value/100,v.maxSave):v.value;
  }
  _payTotal=sub-disc;

  closeCart();
  openPayment(_payMethod);
}

/* ════════════════════════════════════════════
   CINEMATIC PAYMENT SYSTEM
════════════════════════════════════════════ */
function openPayment(method){
  method=method||_payMethod;
  if(!method) return;
  _payMethod=method;

  const modal=document.getElementById('payModal');
  if(!modal) return;
  document.body.style.overflow='hidden';

  // Stage 1: Reveal method with particles
  pfsShowStage('pfs1');
  setTxt('pfs1Amount',fmtRp(_payTotal));

  const ST=getState()||{cart:[],products:[]};
  const itemNames=ST.cart.slice(0,3).map(i=>(ST.products.find(x=>x.id===i.id)||{}).title||'Game').join(', ');
  setTxt('pfs1Items',ST.cart.length+' game: '+itemNames+(ST.cart.length>3?'...':''));

  // Show only the selected method badge, hide others
  ['dana','gopay','alfamart'].forEach(m=>{
    const badge=document.getElementById(`pfs1Badge${m.charAt(0).toUpperCase()+m.slice(1)}`);
    if(badge){
      badge.style.display=m===method?'flex':'none';
      badge.onclick=()=>pfsGotoMethod(method);
    }
  });

  // Spawn stage-1 particles
  spawnStage1Particles(method);

  modal.classList.add('show');

  // Auto-advance after 1.8s to payment screen
  setTimeout(()=>pfsGotoMethod(method), 1800);
}

function closePayment(){
  const modal=document.getElementById('payModal');
  if(modal) modal.classList.remove('show');
  document.body.style.overflow='';
  if(_gopayTimerIv){clearInterval(_gopayTimerIv);_gopayTimerIv=null;}
}

function pfsGotoMethod(method){
  if(method==='dana')     initDanaStage();
  else if(method==='gopay')  initGopayStage();
  else if(method==='alfamart') initAlfaStage();
}

/* ── STAGE helpers ── */
function pfsShowStage(id){
  document.querySelectorAll('.pfs-stage').forEach(s=>{
    if(s.classList.contains('active')){
      s.classList.add('exit');
      setTimeout(()=>{s.classList.remove('active','exit');s.style.display='none';},280);
    } else {
      s.classList.remove('active','exit');
      s.style.display='none';
    }
  });
  const el=document.getElementById(id);
  if(el){
    el.style.display='flex';
    void el.offsetWidth;
    el.classList.add('active');
  }
}

/* ── Stage 1 particles ── */
function spawnStage1Particles(method){
  const c=document.getElementById('pfs1Particles');
  if(!c){return;}
  c.innerHTML='';
  const colors={dana:['#118EEA','#00c4ff','rgba(17,142,234,.4)'],gopay:['#00AED6','#00c4d6','rgba(0,174,214,.4)'],alfamart:['#E31E24','#F7A800','rgba(227,30,36,.3)']}[method]||['#c9a84c','#e8d48b'];
  for(let i=0;i<28;i++){
    const d=document.createElement('div');d.className='fp';
    const size=4+Math.random()*10;
    d.style.cssText=`width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${40+Math.random()*60}%;
      background:${colors[i%colors.length]};
      animation:fpFloat ${2+Math.random()*3}s ease ${Math.random()*1.5}s both;
      opacity:0;`;
    c.appendChild(d);
  }
}

/* ════════════ DANA ════════════ */
function initDanaStage(){
  pfsShowStage('pfs2Dana');

  // Clock
  const tick=()=>{const n=new Date();const el=document.getElementById('ppTime');if(el)el.textContent=n.getHours().toString().padStart(2,'0')+':'+n.getMinutes().toString().padStart(2,'0');};
  tick();

  // Amount
  setTxt('ppAmount',fmtRp(_payTotal));

  // DANA balance: 367 juta (always >= purchase for UX)
  const _DANA_BALANCE = 367000000;
  setTimeout(()=>{
    const fill=document.getElementById('ppBalanceFill');
    const balEl=document.getElementById('ppBalance');
    // Balance bar: show proportion (capped at 95%)
    const pct=Math.min(95, 95 - (_payTotal/_DANA_BALANCE)*30);
    if(fill){setTimeout(()=>{fill.style.width=pct+'%';},200);}
    if(balEl){
      // Animate counter from 0 to 367.000.000
      let v=0;const target=_DANA_BALANCE;const steps=40;const step=target/steps;
      const iv=setInterval(()=>{v=Math.min(v+step*3,target);balEl.textContent='Rp\u00a0'+Math.round(v).toLocaleString('id-ID');if(v>=target)clearInterval(iv);},35);
    }
  },400);

  // Step progression
  setTimeout(()=>pfsActivateStep('danaStep1'),600);
  setTimeout(()=>pfsDoneStep('danaStep1'),1200);
}

function danaConfirm(){
  const btn=document.getElementById('ppPayBtn');
  if(!btn||btn.disabled)return;
  
  // Balance check: 367 juta
  const DANA_BALANCE=367000000;
  if(_payTotal>DANA_BALANCE){
    // Insufficient balance animation
    const balEl=document.getElementById('ppBalance');
    if(balEl){balEl.style.color='#ff4444';balEl.style.animation='shake .4s ease';}
    const trx=document.getElementById('ppAmount');
    if(trx){trx.style.color='#ff4444';}
    btn.innerHTML='<span style="color:#ffcccc">Saldo Tidak Cukup ✗</span>';
    setTimeout(()=>{
      btn.innerHTML='<span>Bayar Sekarang</span>';
      if(balEl){balEl.style.color='';balEl.style.animation='';}
      if(trx){trx.style.color='';}
    },2200);
    return;
  }
  
  btn.disabled=true;
  btn.innerHTML='<span style="opacity:.7">Verifikasi PIN...</span>';
  pfsDoneStep('danaStep1');
  setTimeout(()=>pfsActivateStep('danaStep2'),400);

  pfsShowStage('pfs3');
  pfsBuildProcessing('dana','Memverifikasi PIN DANA...',['Memeriksa saldo','Memproses transfer','Konfirmasi merchant','Menyelesaikan']);
  pfsProcSequence(['Memeriksa saldo','Memproses transfer','Konfirmasi merchant','Menyelesaikan'], 900, ()=>finishPayment('DANA'));
}

/* ════════════ GOPAY ════════════ */
function initGopayStage(){
  pfsShowStage('pfs2Gopay');
  setTxt('pfsGopayAmt',fmtRp(_payTotal));

  // Draw QR
  setTimeout(()=>drawHoloQR('pfsQrCanvas'),200);

  // Timer bar
  _gopayTimeLeft=180;
  const fill=document.getElementById('gqsTimerFill');
  const timerTxt=document.getElementById('gqsTimer');
  if(_gopayTimerIv) clearInterval(_gopayTimerIv);
  _gopayTimerIv=setInterval(()=>{
    _gopayTimeLeft--;
    if(timerTxt) timerTxt.textContent=Math.floor(_gopayTimeLeft/60).toString().padStart(2,'0')+':'+(_gopayTimeLeft%60).toString().padStart(2,'0');
    if(fill) fill.style.width=(_gopayTimeLeft/180*100)+'%';
    if(_gopayTimeLeft<=0){clearInterval(_gopayTimerIv);_gopayTimerIv=null;if(timerTxt){timerTxt.textContent='00:00';timerTxt.style.color='var(--red)';}}
  },1000);

  setTimeout(()=>pfsActivateStep('gopayStep1'),400);
}

function drawHoloQR(canvasId){
  const cv=document.getElementById(canvasId);if(!cv)return;
  const ctx=cv.getContext('2d');
  const s=160,cell=Math.floor(s/21);
  const seed=(_payTotal+Date.now()%99999)|0;
  const pat=(i,j)=>{
    if(i<7&&j<7)return 1;if(i<7&&j>13)return 1;if(i>13&&j<7)return 1;
    const v=(seed*(i*21+j+1)*2654435761)>>>0;return(v%5)<2?1:0;
  };
  ctx.fillStyle='#fff';ctx.fillRect(0,0,s,s);
  for(let i=0;i<21;i++)for(let j=0;j<21;j++){
    if(pat(i,j)){ctx.fillStyle='#0a1a2a';ctx.fillRect(j*cell,i*cell,cell-1,cell-1);}
  }
  ctx.fillStyle='#fff';ctx.fillRect(s/2-22,s/2-22,44,44);
}

function simulateGopay(){
  if(_gopayTimerIv){clearInterval(_gopayTimerIv);_gopayTimerIv=null;}
  pfsDoneStep('gopayStep1');
  setTimeout(()=>pfsActivateStep('gopayStep2'),300);
  setTimeout(()=>pfsDoneStep('gopayStep2'),900);
  setTimeout(()=>pfsActivateStep('gopayStep3'),1000);

  pfsShowStage('pfs3');
  pfsBuildProcessing('gopay','Membaca QR Code GoPay...',['Menghubungkan ke server','Memverifikasi akun Gojek','Memproses pembayaran','Konfirmasi selesai']);
  pfsProcSequence(['Menghubungkan ke server','Memverifikasi akun Gojek','Memproses pembayaran','Konfirmasi selesai'],900,()=>finishPayment('GoPay'));
}

/* ════════════ ALFAMART ════════════ */
function initAlfaStage(){
  pfsShowStage('pfs2Alfa');

  // Generate code
  const seg=()=>String(Math.floor(Math.random()*9000+1000));
  _alfaCode=String(Math.floor(Math.random()*900+100))+seg()+seg();

  const digits=document.getElementById('atCodeDigits');
  if(digits){
    digits.textContent='— — —';
    setTimeout(()=>{
      digits.style.animation='none';void digits.offsetWidth;
      digits.style.animation='codeReveal .5s var(--ease) both';
      digits.textContent=_alfaCode.replace(/(\d{3})(\d{4})(\d{4})/,'$1 $2 $3');
    },400);
  }
  setTimeout(()=>drawAlfaBarcode('atBarcode',_alfaCode),300);

  const exp=new Date(Date.now()+86400000);
  setTxt('atAmt',fmtRp(_payTotal));
  setTxt('atExp',exp.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})+', '+exp.getHours().toString().padStart(2,'0')+':00 WIB');
}

function drawAlfaBarcode(containerId,code){
  const c=document.getElementById(containerId);if(!c)return;
  const W=280,H=60,bars=[];
  const digits=code.padStart(12,'0').split('').map(Number);
  let tw=0;
  for(let i=0;i<90;i++){
    const d=digits[i%digits.length];
    const w=((d*(i+1)*1103515245+12345)>>>0)%3+1;
    const dark=(((d+i)*2654435761)>>>0)%4<2;
    bars.push({w,dark});tw+=w;
  }
  const scale=W/tw;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H+16}"><rect width="${W}" height="${H+16}" fill="white"/>`;
  let x=0;
  bars.forEach(b=>{const bw=b.w*scale;if(b.dark)svg+=`<rect x="${x.toFixed(1)}" y="4" width="${(bw-.5).toFixed(1)}" height="${H}" fill="#1a1a1a"/>`;x+=bw;});
  svg+=`<text x="${W/2}" y="${H+14}" text-anchor="middle" font-family="Courier New,monospace" font-size="8" fill="#555" letter-spacing="2">${code.replace(/(\d{3})(\d{4})(\d{4})/,'$1 $2 $3')}</text></svg>`;
  c.innerHTML=svg;
}

function copyAlfaCode(){
  const btn=document.querySelector('.at-copy-btn');
  if(navigator.clipboard) navigator.clipboard.writeText(_alfaCode).then(()=>{
    if(btn){btn.style.color='#4caa7a';btn.innerHTML='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Tersalin!';}
    setTimeout(()=>{if(btn){btn.style.color='';btn.innerHTML='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Salin Kode';}},2500);
  }); else if(typeof toast==='function') toast('Kode: '+_alfaCode,'ok');
}

function simulateAlfa(){
  pfsShowStage('pfs3');
  pfsBuildProcessing('alfamart','Menghubungi server Alfamart...',['Verifikasi kode pembayaran','Cek nominal','Konfirmasi kasir','Pembayaran diterima']);
  pfsProcSequence(['Verifikasi kode pembayaran','Cek nominal','Konfirmasi kasir','Pembayaran diterima'],900,()=>finishPayment('Alfamart'));
}

/* ════════════ PROCESSING STAGE ════════════ */
const PROC_COLORS={dana:'#118EEA',gopay:'#00AED6',alfamart:'#E31E24'};
const PROC_ICONS ={dana:'💙',gopay:'🔵',alfamart:'🏪'};

function pfsBuildProcessing(method,title,steps){
  const visual=document.getElementById('pfsProcVisual');
  const titleEl=document.getElementById('pfsProcTitle');
  const subEl  =document.getElementById('pfsProcSub');
  const stepsEl=document.getElementById('pfsProcSteps');

  const col=PROC_COLORS[method]||'var(--g50)';
  const ico=PROC_ICONS[method]||'⚡';

  if(visual){
    visual.innerHTML=`
      <div class="proc-${method}-loader proc-dana-loader" style="position:absolute;inset:0;--col:${col};">
        <div class="proc-dana-loader" style="position:absolute;inset:0;"></div>
        <div class="proc-dana-loader" style="position:absolute;inset:0;border-top-color:${col}!important;border-bottom-color:${col}33!important;animation:prcSpin .9s linear infinite;"></div>
        <div style="position:absolute;inset:14px;border-radius:50%;border:3px solid transparent;border-top-color:${col}55;animation:prcSpin 1.6s linear infinite reverse;"></div>
      </div>
      <div class="proc-dana-icon" style="font-size:2.4rem;z-index:1;">${ico}</div>`;
  }
  if(titleEl) titleEl.textContent=title;
  if(subEl)   subEl.textContent='Enkripsi AES-256 aktif…';
  if(stepsEl){
    stepsEl.innerHTML=steps.map((s,i)=>`
      <div class="pfs-proc-step" id="procStep${i}">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/></svg>
        ${s}
      </div>`).join('');
  }
}

function pfsProcSequence(steps,delay,onDone){
  steps.forEach((s,i)=>{
    setTimeout(()=>{
      const el=document.getElementById(`procStep${i}`);
      if(el){
        el.className='pfs-proc-step active';
        el.innerHTML=`<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--g50)"><polyline points="2 8 6 12 14 4"/></svg>${steps[i]}`;
        // Mark prev as done
        if(i>0){const prev=document.getElementById(`procStep${i-1}`);if(prev)prev.className='pfs-proc-step done';}
      }
      const sub=document.getElementById('pfsProcSub');
      if(sub) sub.textContent=s+'…';
    },i*delay);
  });
  setTimeout(()=>{
    const last=document.getElementById(`procStep${steps.length-1}`);
    if(last)last.className='pfs-proc-step done';
    onDone();
  },steps.length*delay+400);
}

function pfsActivateStep(id){const el=document.getElementById(id);if(el)el.className='pfs-step-item active';}
function pfsDoneStep(id){const el=document.getElementById(id);if(el)el.className='pfs-step-item done';}

/* ════════════ FINISH PAYMENT ════════════ */
async function finishPayment(methodLabel){
  const ST=getState();
  if(!ST) return;

  // Persist purchase
  const rev=await MLS.Store.getRev();await MLS.Store.setRev(rev+_payTotal);
  const users=await MLS.Store.getUsers();
  const ui=users.findIndex(u=>u.email===ST.user?.email);
  if(ui>=0){
    users[ui].purchases=[...new Set([...(users[ui].purchases||[]),...ST.cart.map(i=>i.id)])];
    const pts=Math.floor(_payTotal/1000);
    users[ui].points=(users[ui].points||0)+pts;
    await MLS.Store.setUsers(users);
    ST.user={...users[ui]};
    await MLS.Sess.create({...ST.user,role:'user'});
  }

  // Build receipt
  const txId=MLS.randHex(4).toUpperCase();
  const now=new Date().toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const pts=Math.floor(_payTotal/1000);
  const receiptHTML=`
    <div class="pfs-receipt-row"><span>Metode</span><span style="color:var(--w80)">${MLS.San.html(methodLabel)}</span></div>
    <div class="pfs-receipt-row"><span>Waktu</span><span>${MLS.San.html(now)}</span></div>
    <div class="pfs-receipt-row"><span>ID Transaksi</span><span style="font-family:monospace">TXN-${txId}</span></div>
    <div class="pfs-receipt-row"><span>Item</span><span>${ST.cart.length} game</span></div>
    <div class="pfs-receipt-row total"><span>Total</span><span>${fmtRp(_payTotal)}</span></div>`;

  setTxt('pfsSuccessSub',`via ${methodLabel} · ID: TXN-${txId}`);
  setHTML('pfsReceipt',receiptHTML);

  const reward=document.getElementById('pfsRewardBanner');
  if(reward&&pts>0){
    reward.className='pfs-reward-banner points';
    reward.textContent=`🌟 +${pts} poin ditambahkan ke akunmu!`;
  }

  spawnSuccessConfetti();
  pfsShowStage('pfs4');
}

function spawnSuccessConfetti(){
  const c=document.getElementById('pfsConfetti');if(!c)return;c.innerHTML='';
  const method=_payMethod;
  const palettes={
    dana:   ['#118EEA','#00c4ff','#fff','#c9a84c','#e8d48b'],
    gopay:  ['#00AED6','#00c4d6','#fff','#c9a84c','#e8d48b'],
    alfamart:['#E31E24','#F7A800','#fff','#c9a84c','#e8d48b'],
  };
  const cols=palettes[method]||['#c9a84c','#e8d48b','#fff'];
  for(let i=0;i<70;i++){
    const d=document.createElement('div');d.className='cp';
    const size=5+Math.random()*10;
    const shapes=['50%','2px','4px'];
    d.style.cssText=`
      left:${Math.random()*100}%;
      width:${size}px;height:${size}px;
      background:${cols[i%cols.length]};
      border-radius:${shapes[Math.floor(Math.random()*3)]};
      animation:cpFall ${1.5+Math.random()*2}s linear ${Math.random()*.8}s forwards;
      transform-origin:center;
    `;
    c.appendChild(d);
  }
}

function donePayment(){
  const ST=getState();
  if(!ST) return;
  ST.cart=[];ST.appliedVoucher=null;
  MLS.Store.setCart([]);
  _payMethod='';
  // Reset method selector in cart
  document.querySelectorAll('.mcp-pay-card').forEach(c=>c.classList.remove('selected'));

  closePayment();
  if(typeof updateCartBadge==='function') updateCartBadge();
  if(typeof renderProfile==='function') setTimeout(renderProfile,200);
  if(typeof toast==='function') toast('🎉 Pembelian berhasil! Cek koleksimu.','ok');
  if(typeof checkAch==='function'){checkAch('purchase');checkAch('spend');}
  if(typeof goPage==='function') goPage('profile');
}

/* ── helpers ── */
function setTxt(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
function setHTML(id,val){const el=document.getElementById(id);if(el)el.innerHTML=val;}
function fmtRp(n){return 'Rp\u00a0'+Math.round(n||0).toLocaleString('id-ID');}

/* ════════════════════════════════════════════
   EXPOSE
════════════════════════════════════════════ */
const CHECKOUT_API={
  openCart,closeCart,mcpTab,
  mcpRemoveCart,mcpWishToCart,mcpRemoveWish,
  selectMcpMethod,doMcpCheckout,
  openPayment,closePayment,
  danaConfirm,simulateGopay,simulateAlfa,
  copyAlfaCode,donePayment,
  renderMcpCart,renderMcpWish,syncMcpSummary,syncMcpBadges,
};
G.CHECKOUT=CHECKOUT_API;
// Merge into ML if it exists
if(G.ML) Object.assign(G.ML,CHECKOUT_API);

})(window);
