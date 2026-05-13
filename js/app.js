/**
 * Market L — App Engine v3.1
 * Fixes: cart images, async order, CSS class gaps, norak words removed,
 *        password strength meter, skeleton loading, error boundaries,
 *        fetch error handling, mobile UX improvements
 */
;(function(){'use strict';

/* ═══ STATE ═══ */
const ST={
  products:[],vouchers:[],achievements:[],missions:[],
  cart:[],wish:[],user:null,
  page:'home',heroIdx:0,heroFeat:[],_heroT:null,_dealT:null,
  catFilter:'all',appliedVoucher:null,
  prodRatings:{},webRating:{total:0,count:0},
  viewedToday:0,initialized:false,loadError:false,
};

/* ═══ DOM HELPERS ═══ */
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const on = (el,ev,fn,opt) => el?.addEventListener(ev,fn,opt||false);
const clamp  = (v,a,b) => Math.min(b,Math.max(a,v));
const fmtRp  = n => 'Rp\u00a0'+Number(n).toLocaleString('id-ID');
const setTxt = (id,v) => { const e=$(id); if(e) e.textContent=v; };
const setHTML= (id,v) => { const e=$(id); if(e) e.innerHTML=v; };

function starsHTML(r,max=5){
  r=clamp(+r||0,0,max);
  const f=Math.floor(r),h=(r%1)>=.45;
  return '<span style="color:var(--g50);letter-spacing:.5px">'+
    '★'.repeat(f)+(h?'½':'')+'☆'.repeat(max-f-(h?1:0))+'</span>';
}
function avgRating(pid,def){
  const arr=ST.prodRatings[pid];
  if(!arr||!arr.length)return +def||0;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

/* ═══ BOOT ═══ */
async function boot(){
  try{
    showSkeleton();
    await loadData();
    await hydrateStore();
    await restoreSession();
    render();
    hideSkeleton();
    bindAll();
    scrollFX();
    startHero();
    startDealClock();
    spawnParticles();
    animLoader();
    ST.initialized=true;
  }catch(err){
    console.error('[MarketL boot]',err);
    hideSkeleton();
    animLoader();
    // Show friendly error if fetch fails (e.g. file:// without server)
    if(err.message?.includes('fetch')||err.name==='TypeError'){
      showFetchError();
    }
  }
}

function showFetchError(){
  const h=$('homeGrid');
  if(h) h.innerHTML=`<div class="empty-state" style="grid-column:1/-1">
    <div class="empty-ico">⚠️</div>
    <p style="font-size:.9rem;margin-bottom:12px">Buka file ini menggunakan <b>Live Server</b> (VS Code),<br>bukan dengan double-click file HTML.</p>
    <p style="font-size:.78rem;color:var(--w40)">Install ekstensi <em>Live Server</em> → klik kanan index.html → Open with Live Server</p>
  </div>`;
}

function showSkeleton(){
  const g=$('homeGrid');
  if(g) g.innerHTML=Array(6).fill(0).map(()=>`
    <div class="prod-card" style="pointer-events:none">
      <div class="skel" style="aspect-ratio:16/9"></div>
      <div class="prod-body">
        <div class="skel" style="height:10px;width:60%;margin-bottom:8px;border-radius:4px"></div>
        <div class="skel" style="height:14px;width:85%;margin-bottom:6px;border-radius:4px"></div>
        <div class="skel" style="height:10px;width:40%;border-radius:4px"></div>
      </div>
    </div>`).join('');
}
function hideSkeleton(){}

async function loadData(){
  const[p,v,a,m]=await Promise.all([
    fetch('json/products.json').then(r=>{if(!r.ok)throw new Error('fetch');return r.json();}),
    fetch('json/vouchers.json').then(r=>{if(!r.ok)throw new Error('fetch');return r.json();}),
    fetch('json/achievements.json').then(r=>{if(!r.ok)throw new Error('fetch');return r.json();}),
    fetch('json/missions.json').then(r=>{if(!r.ok)throw new Error('fetch');return r.json();}),
  ]);
  ST.products=p;
  const custom=await MLS.Store.getVcustom();
  ST.vouchers=[...v,...custom];
  ST.achievements=a;ST.missions=m;
}

async function hydrateStore(){
  ST.cart=await MLS.Store.getCart();
  ST.wish=await MLS.Store.getWish();
  ST.prodRatings=await MLS.Store.getProdR();
  ST.webRating=await MLS.Store.getWebR();
}

async function restoreSession(){
  const u=await MLS.Auth.currentUser();
  if(u){ST.user=u;authUI();}
}

function animLoader(){
  let p=0;
  const fill=$('ldFill'),num=$('ldNum');
  const iv=setInterval(()=>{
    p=clamp(p+Math.random()*9+2,0,100);
    if(fill)fill.style.width=p+'%';
    if(num)num.textContent=Math.round(p)+'%';
    if(p>=100){clearInterval(iv);setTimeout(()=>$('ml-loader')?.classList.add('gone'),420);}
  },55);
}

/* ═══ RENDER ═══ */
function render(){
  renderHero();
  renderFeatured();
  renderHomeGrid();
  renderStoreGrid();
  renderDealsGrid();
  renderVoucherCards();
  updateCartBadge();
  updateWishBadge();
  updateWebRatingDisplay();
  observeReveal();
}

/* ═══ HERO ═══ */
function renderHero(){
  ST.heroFeat=ST.products.filter(p=>p.featured);
  const slides=$('heroSlides'),dots=$('heroDots');
  if(!slides)return;
  slides.innerHTML=ST.heroFeat.map((p,i)=>`
    <div class="hero-slide${i===0?' active':''}" data-i="${i}">
      <img src="${p.steamImg}" alt="${MLS.San.html(p.name)}"
        loading="${i===0?'eager':'lazy'}"
        onerror="this.onerror=null;this.src='${p.localImage}'"
        style="width:100%;height:100%;object-fit:cover;opacity:.5">
    </div>`).join('');
  if(dots) dots.innerHTML=ST.heroFeat.map((_,i)=>`
    <button class="hero-dot${i===0?' on':''}" onclick="ML.heroSlide(${i})" aria-label="Slide ${i+1}"></button>`).join('');
  updateHeroText(0);
}

function updateHeroText(i){
  const p=ST.heroFeat[i];if(!p)return;
  setTxt('heroDev',p.developer+' · '+p.genre.slice(0,2).join(', '));
  setTxt('heroPrice',fmtRp(p.price));
  const ob=$('heroOrig'),db=$('heroDiscBadge');
  if(ob)ob.textContent=p.originalPrice>p.price?fmtRp(p.originalPrice):'';
  if(db){db.textContent=p.discount>0?`-${p.discount}%`:'';db.style.display=p.discount>0?'inline-flex':'none';}
  const bb=$('heroBuyBtn');if(bb)bb.onclick=()=>addCart(p.id);
  const dd=$('heroDetailBtn');if(dd)dd.onclick=()=>openProd(p.id);
}

function startHero(){
  if(ST.heroFeat.length<2)return;
  ST._heroT=setInterval(()=>heroSlide((ST.heroIdx+1)%ST.heroFeat.length),5500);
}
function heroSlide(i){
  ST.heroIdx=i;
  $$('.hero-slide').forEach((s,j)=>s.classList.toggle('active',j===i));
  $$('.hero-dot').forEach((d,j)=>d.classList.toggle('on',j===i));
  updateHeroText(i);
}

/* ═══ DEAL CLOCK ═══ */
function startDealClock(){
  const tick=()=>{
    const now=new Date(),end=new Date();
    end.setHours(23,59,59,999);
    const d=end-now,pad=n=>String(Math.floor(n)).padStart(2,'0');
    const h=pad(d/3.6e6),m=pad((d%3.6e6)/6e4),s=pad((d%6e4)/1e3);
    [$('tmH1'),$('tmH2')].forEach(e=>{if(e)e.textContent=h;});
    [$('tmM1'),$('tmM2')].forEach(e=>{if(e)e.textContent=m;});
    [$('tmS1'),$('tmS2')].forEach(e=>{if(e)e.textContent=s;});
  };
  tick();ST._dealT=setInterval(tick,1000);
}

/* ═══ FEATURED TRACK ═══ */
function renderFeatured(){
  const t=$('featTrack');if(!t)return;
  t.innerHTML=ST.products.filter(p=>p.featured).map(p=>`
    <div class="feat-slide">
      <article class="feat-card" onclick="ML.openProd(${p.id})">
        <div class="feat-img">
          <img src="${p.steamImg}" alt="${MLS.San.html(p.name)}" loading="lazy"
            onerror="this.onerror=null;this.src='${p.localImage}'">
          ${p.discount>0?`<span class="disc-badge red">-${p.discount}%</span>`:''}
        </div>
        <div class="feat-body">
          <p class="feat-dev">${MLS.San.html(p.developer)}</p>
          <h3 class="feat-title">${MLS.San.html(p.name)}</h3>
          <div class="feat-tags">${p.tags.slice(0,2).map(tg=>`<span class="tag">${MLS.San.html(tg)}</span>`).join('')}</div>
          <div class="feat-foot">
            <div>
              <div class="price-main">${fmtRp(p.price)}</div>
              ${p.originalPrice>p.price?`<div class="price-orig">${fmtRp(p.originalPrice)}</div>`:''}
            </div>
            <button class="btn-sm-gold" onclick="event.stopPropagation();ML.addCart(${p.id})">+ Keranjang</button>
          </div>
        </div>
      </article>
    </div>`).join('');
}

/* ═══ PRODUCT CARD ═══ */
function prodCard(p){
  const wished=ST.wish.includes(p.id);
  const avg=avgRating(p.id,p.rating);
  return `
  <article class="prod-card reveal" onclick="ML.openProd(${p.id})">
    <div class="prod-thumb">
      <img src="${p.steamImg}" alt="${MLS.San.html(p.name)}" loading="lazy"
        onerror="this.onerror=null;this.src='${p.localImage}'">
      ${p.discount>0?`<span class="disc-badge ${p.discount>=50?'red':'gold'}">-${p.discount}%</span>`:''}
      <button class="wish-btn${wished?' on':''}"
        onclick="event.stopPropagation();ML.toggleWish(${p.id},this)"
        aria-label="${wished?'Hapus dari':'Tambah ke'} wishlist">
        <svg viewBox="0 0 24 24" width="13" height="13"
          fill="${wished?'currentColor':'none'}" stroke="currentColor" stroke-width="2.2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      <div class="prod-overlay">
        <button class="ov-gold" onclick="event.stopPropagation();ML.addCart(${p.id})">🛒 Keranjang</button>
        <button class="ov-ghost" onclick="event.stopPropagation();ML.openProd(${p.id})">Detail</button>
      </div>
    </div>
    <div class="prod-body">
      <div class="genres">${p.genre.slice(0,2).map(g=>`<span class="genre">${MLS.San.html(g)}</span>`).join('')}</div>
      <h3 class="prod-name">${MLS.San.html(p.name)}</h3>
      <p class="prod-dev">${MLS.San.html(p.developer)}</p>
      <div class="star-row">
        ${starsHTML(avg)}
        <span class="ravg">${avg.toFixed(1)}</span>
        <span class="rcnt">(${p.reviews.toLocaleString('id-ID')})</span>
      </div>
      <div class="price-row">
        <div>
          <div class="price-main">${fmtRp(p.price)}</div>
          ${p.originalPrice>p.price?`<div class="price-orig">${fmtRp(p.originalPrice)}</div>`:''}
        </div>
        ${p.metacritic?`<span class="mc">${p.metacritic}</span>`:''}
      </div>
    </div>
  </article>`;
}

function renderHomeGrid(){ const g=$('homeGrid');if(!g)return;g.innerHTML=ST.products.slice(0,6).map(prodCard).join('');observeReveal(); }
function renderStoreGrid(list=null){
  const g=$('storeGrid');if(!g)return;
  let prods=list||ST.products;
  if(ST.catFilter!=='all') prods=prods.filter(p=>p.genre.map(x=>x.toLowerCase()).includes(ST.catFilter));
  if(!prods.length){g.innerHTML=`<div class="empty-state"><div class="empty-ico">🎮</div><p>Tidak ada game ditemukan</p></div>`;return;}
  g.innerHTML=prods.map(prodCard).join('');observeReveal();
}
function renderDealsGrid(){ const g=$('dealsGrid');if(!g)return;g.innerHTML=ST.products.filter(p=>p.discount>=23).map(prodCard).join('');observeReveal(); }

function renderVoucherCards(){
  const g=$('vchrGrid');if(!g)return;
  g.innerHTML=ST.vouchers.filter(v=>v.active).map(v=>`
    <div class="vchr-card reveal">
      <div class="vchr-shine"></div>
      <div class="vchr-top">
        <span class="vchr-type">${v.type==='pct'?v.value+'% DISKON':'Hemat '+fmtRp(v.value)}</span>
        <span class="vchr-code">${MLS.San.html(v.code)}</span>
      </div>
      <p class="vchr-desc">${MLS.San.html(v.desc)}</p>
      <div class="vchr-meta">
        <span>Min. ${fmtRp(v.minBuy)}</span><span>Exp: ${MLS.San.html(v.exp)}</span>
      </div>
      <button class="vchr-copy-btn" onclick="ML.copyVoucher('${MLS.San.html(v.code)}')">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>Salin Kode
      </button>
    </div>`).join('');
  observeReveal();
}

function copyVoucher(code){
  if(navigator.clipboard) navigator.clipboard.writeText(code).then(()=>toast(`Kode <b>${code}</b> disalin!`,'ok'));
  else toast('Kode: '+code,'ok');
}

/* ═══ PRODUCT MODAL ═══ */
function openProd(id){
  const p=ST.products.find(x=>x.id===id);if(!p)return;
  const modal=$('prodModal');if(!modal)return;
  const avg=avgRating(p.id,p.rating);
  ST.viewedToday++;
  MLS.Store.getViews().then(v=>MLS.Store.setViews(v+1));

  // FIX: hero image with proper fallback chain
  const hero=$('mHero');
  if(hero){
    hero.src=p.steamImg;
    hero.onerror=function(){
      this.onerror=null;
      this.src=p.localImage;
    };
  }

  setTxt('mTitle',p.name);
  setTxt('mDev','by '+p.developer+' · '+p.publisher);
  setHTML('mStars',starsHTML(avg));
  setTxt('mRavg',avg.toFixed(1));
  setTxt('mRcnt','('+p.reviews.toLocaleString('id-ID')+' ulasan)');
  setTxt('mPrice',fmtRp(p.price));
  setTxt('mOrig',p.originalPrice>p.price?fmtRp(p.originalPrice):'');
  setTxt('mDisc',p.discount>0?'-'+p.discount+'% OFF':'');
  setTxt('mDesc',p.fullDesc||p.description);
  setHTML('mTags',p.tags.map(tg=>`<span class="modal-tag">${MLS.San.html(tg)}</span>`).join(''));
  setTxt('mPlatform',p.platform.join(', '));
  setTxt('mGenre',p.genre.join(', '));
  setTxt('mSize',p.size);
  setTxt('mAge',p.ageRating);
  setTxt('mAch',p.achievements+' pencapaian');
  setTxt('mRel',new Date(p.releaseDate).toLocaleDateString('id-ID',{year:'numeric',month:'long',day:'numeric'}));
  setTxt('mMeta',p.metacritic?p.metacritic+' / 100':'N/A');

  const cab=$('mAddCart');
  if(cab) cab.onclick=()=>{addCart(id);toast('🛒 '+p.name+' ditambahkan!','ok');};
  const wb=$('mWishBtn');
  if(wb){ wb.onclick=()=>{toggleWish(id);wb.textContent=ST.wish.includes(id)?'❤️ Wishlist':'🤍 Wishlist';};
    wb.textContent=ST.wish.includes(id)?'❤️ Wishlist':'🤍 Wishlist'; }

  buildStarPicker($('mStarPick'),(ST.prodRatings[id]||[]).slice(-1)[0]||0,r=>{
    if(!ST.prodRatings[id])ST.prodRatings[id]=[];
    ST.prodRatings[id].push(r);
    MLS.Store.setProdR(ST.prodRatings);
    toast('Rating '+r+'⭐ tersimpan!','ok');
    checkAch('review');
    const el=$('mRavg');if(el)el.textContent=avgRating(id,p.rating).toFixed(1);
  });

  modal.classList.add('show');
  document.body.style.overflow='hidden';
  checkAch('view');
}

function closeProdModal(){$('prodModal')?.classList.remove('show');document.body.style.overflow='';}

function buildStarPicker(container,current,onChange){
  if(!container)return;
  container.innerHTML='';
  for(let i=1;i<=5;i++){
    const span=document.createElement('span');
    span.className='sp'+(i<=current?' lit':'');
    span.textContent=i<=current?'⭐':'☆';
    span.dataset.v=i;
    const update=n=>container.querySelectorAll('.sp').forEach((s,j)=>{
      s.className='sp'+(j<n?' lit':'');s.textContent=j<n?'⭐':'☆';
    });
    span.onmouseover=()=>update(i);
    span.onmouseout=()=>update(+container.dataset.c||0);
    span.onclick=()=>{container.dataset.c=i;update(i);if(onChange)onChange(i);};
    container.appendChild(span);
  }
  container.dataset.c=current;
}

/* ═══ CART — FIX: uses steamImg with localImage fallback ═══ */
function addCart(id){
  const p=ST.products.find(x=>x.id===id);if(!p)return;
  if(ST.cart.find(i=>i.id===id)){toast(p.name+' sudah ada di keranjang');return;}
  ST.cart.push({id,price:p.price});
  MLS.Store.setCart(ST.cart);
  updateCartBadge();renderCartItems();checkAch('cart');
}
function removeCart(id){
  ST.cart=ST.cart.filter(i=>i.id!==id);
  MLS.Store.setCart(ST.cart);
  updateCartBadge();renderCartItems();toast('Item dihapus');
}
function updateCartBadge(){
  const b=$('cartBadge');
  if(b){b.textContent=ST.cart.length;b.style.display=ST.cart.length?'flex':'none';}
}
function renderCartItems(){
  const body=$('cartBody'),empty=$('cartEmpty');if(!body)return;
  if(!ST.cart.length){
    body.innerHTML='';
    if(empty){empty.style.display='flex';empty.style.flexDirection='column';}
    updateCartTotal();return;
  }
  if(empty)empty.style.display='none';
  // FIX: Use steamImg with localImage fallback for cart thumbnails
  body.innerHTML=ST.cart.map(item=>{
    const p=ST.products.find(x=>x.id===item.id);if(!p)return'';
    return `<div class="cart-item">
      <img class="cart-img"
        src="${p.steamImg}"
        alt="${MLS.San.html(p.name)}"
        onerror="this.onerror=null;this.src='${p.localImage}'">
      <div class="cart-info">
        <div class="cart-name">${MLS.San.html(p.name)}</div>
        <div class="cart-plat">${MLS.San.html(p.platform[0])}</div>
        <div class="cart-price">${fmtRp(item.finalPrice||p.price)}</div>
      </div>
      <button class="cart-rm" onclick="ML.removeCart(${p.id})" aria-label="Hapus">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>`;
  }).join('');
  updateCartTotal();
}
function updateCartTotal(){
  const sub=ST.cart.reduce((s,i)=>{const p=ST.products.find(x=>x.id===i.id);return s+(i.finalPrice||p?.price||0);},0);
  let disc=0;
  if(ST.appliedVoucher){
    const v=ST.vouchers.find(x=>x.code===ST.appliedVoucher&&x.active);
    if(v&&sub>=v.minBuy) disc=v.type==='pct'?Math.min(sub*v.value/100,v.maxSave):v.value;
  }
  setTxt('cartSub',fmtRp(sub));
  setTxt('cartDisc',disc>0?'-'+fmtRp(disc):fmtRp(0));
  setTxt('cartTot',fmtRp(sub-disc));
  const dr=$('cartDiscRow');if(dr)dr.style.display=disc>0?'flex':'none';
}
function openCart(){
  $('cartSidebar')?.classList.add('open');
  $('cartOvr')?.classList.add('on');
  document.body.style.overflow='hidden';
  renderCartItems();
}
function closeCart(){
  $('cartSidebar')?.classList.remove('open');
  $('cartOvr')?.classList.remove('on');
  document.body.style.overflow='';
}
function applyVoucher(){
  const inp=$('voucherInp');if(!inp)return;
  const code=inp.value.trim().toUpperCase();
  if(!MLS.Val.voucherCode(code)){toast('Format kode tidak valid','err');return;}
  const sub=ST.cart.reduce((s,i)=>{const p=ST.products.find(x=>x.id===i.id);return s+(i.finalPrice||p?.price||0);},0);
  const v=ST.vouchers.find(x=>x.code===code&&x.active);
  if(!v){toast('Voucher tidak ditemukan atau tidak aktif','err');return;}
  if(sub<v.minBuy){toast('Minimum pembelian '+fmtRp(v.minBuy),'err');return;}
  ST.appliedVoucher=code;
  const note=$('vchrApplied');
  if(note){note.innerHTML='✅ Voucher <b>'+code+'</b> diterapkan!';note.style.display='flex';}
  updateCartTotal();
  toast('🎟️ Voucher <b>'+code+'</b> berhasil!','ok');
  checkAch('voucher');
}
async function checkout(){
  if(!ST.user){toast('Silakan login terlebih dahulu','err');closeCart();openAuth();return;}
  if(!ST.cart.length){toast('Keranjang masih kosong!','err');return;}
  const total=ST.cart.reduce((s,i)=>{const p=ST.products.find(x=>x.id===i.id);return s+(i.finalPrice||p?.price||0);},0);
  // Update revenue
  const rev=await MLS.Store.getRev();await MLS.Store.setRev(rev+total);
  // Update user
  const users=await MLS.Store.getUsers();
  const ui=users.findIndex(u=>u.email===ST.user.email);
  if(ui>=0){
    const newPurchases=[...new Set([...(users[ui].purchases||[]),...ST.cart.map(i=>i.id)])];
    users[ui].purchases=newPurchases;
    users[ui].points=(users[ui].points||0)+Math.floor(total/1000);
    await MLS.Store.setUsers(users);
    ST.user={...users[ui]};
    await MLS.Sess.create({...ST.user,role:'user'});
  }
  // Clear cart
  ST.cart=[];ST.appliedVoucher=null;
  await MLS.Store.setCart([]);
  const note=$('vchrApplied');if(note)note.style.display='none';
  const vi=$('voucherInp');if(vi)vi.value='';
  updateCartBadge();renderCartItems();closeCart();
  toast('🎉 Pembelian berhasil! Cek di Profil → Pembelian.','ok');
  checkAch('purchase');checkAch('spend');
}

/* ═══ WISHLIST ═══ */
function toggleWish(id,btn){
  const p=ST.products.find(x=>x.id===id);if(!p)return;
  const idx=ST.wish.indexOf(id);
  const heartOn='<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const heartOff='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  if(idx===-1){
    ST.wish.push(id);
    if(btn){btn.classList.add('on');btn.innerHTML=heartOn;}
    toast('❤️ '+p.name+' ditambahkan ke wishlist','ok');checkAch('wishlist');
  }else{
    ST.wish.splice(idx,1);
    if(btn){btn.classList.remove('on');btn.innerHTML=heartOff;}
    toast(p.name+' dihapus dari wishlist');
  }
  MLS.Store.setWish(ST.wish);updateWishBadge();
  if(ST.page==='wishlist')renderWishPage();
}
function updateWishBadge(){
  const b=$('wishBadge');if(b){b.textContent=ST.wish.length;b.style.display=ST.wish.length?'flex':'none';}
}
function renderWishPage(){
  const g=$('wishGrid'),empty=$('wishEmpty');if(!g)return;
  const items=ST.wish.map(id=>ST.products.find(p=>p.id===id)).filter(Boolean);
  if(!items.length){g.innerHTML='';if(empty)empty.style.display='block';return;}
  if(empty)empty.style.display='none';
  g.innerHTML=items.map(prodCard).join('');observeReveal();
}

/* ═══ AUTH ═══ */
function openAuth(tab='login'){
  const m=$('authModal');if(!m)return;
  m.classList.add('show');document.body.style.overflow='hidden';switchAuthTab(tab);
}
function closeAuth(){$('authModal')?.classList.remove('show');document.body.style.overflow='';}
function switchAuthTab(t){
  $$('.auth-tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===t));
  const lp=$('loginPanel'),rp=$('regPanel');
  if(lp)lp.style.display=t==='login'?'block':'none';
  if(rp)rp.style.display=t==='register'?'block':'none';
}

async function handleLogin(e){
  e.preventDefault();
  const btn=$('loginBtn'),email=$('liEmail')?.value,pass=$('liPass')?.value;
  if(btn){btn.disabled=true;btn.textContent='Memproses...';}
  const r=await MLS.Auth.login(email,pass);
  if(btn){btn.disabled=false;btn.textContent='Masuk Sekarang';}
  if(r.ok){ST.user=r.user;authUI();closeAuth();toast('👋 Selamat datang, <b>'+MLS.San.html(ST.user.name)+'</b>!','ok');}
  else toast(r.msg,'err');
}

async function handleRegister(e){
  e.preventDefault();
  const btn=$('regBtn');
  const name=$('rgName')?.value,email=$('rgEmail')?.value;
  const pass=$('rgPass')?.value,pass2=$('rgPass2')?.value;
  if(pass!==pass2){toast('Password tidak cocok!','err');return;}
  if(btn){btn.disabled=true;btn.textContent='Membuat akun...';}
  const r=await MLS.Auth.register(name,email,pass);
  if(btn){btn.disabled=false;btn.textContent='Buat Akun';}
  if(r.ok){ST.user=r.user;authUI();closeAuth();toast('🎉 Selamat datang, <b>'+MLS.San.html(ST.user.name)+'</b>!','ok');}
  else toast(r.msg,'err');
}

/* Password strength UI */
function updatePassStrength(val){
  const bar=$('passStrBar'),lbl=$('passStrLbl');if(!bar||!lbl)return;
  const s=MLS.San.strength(val);
  const colors=['','var(--red)','#e08030','var(--g50)','var(--green)'];
  const labels=['','Sangat lemah','Lemah','Cukup kuat','Kuat'];
  bar.style.width=(s*25)+'%';
  bar.style.background=colors[s]||'var(--b1a)';
  lbl.textContent=labels[s]||'';
  lbl.style.color=colors[s]||'var(--w40)';
}

function handleGoogle(){
  toast('🔗 Menghubungkan ke Google...');
  setTimeout(async()=>{
    const ts=Date.now();
    const r=await MLS.Auth.register('Google User '+ts.toString().slice(-4),'g'+ts+'@gmail.com',MLS.randHex(10));
    if(r.ok){ST.user=r.user;authUI();closeAuth();toast('✅ Masuk dengan Google berhasil!','ok');}
  },1500);
}

async function handleLogout(){
  await MLS.Auth.logout();ST.user=null;authUI();
  if(['wishlist','profile'].includes(ST.page))goPage('home');
  toast('Berhasil keluar');
}

function authUI(){
  const gs=$('authGuest'),us=$('authUser');if(!gs||!us)return;
  if(ST.user){
    gs.style.display='none';us.style.display='flex';
    const av=$('hdAvatar');if(av)av.textContent=(ST.user.name||'U').charAt(0).toUpperCase();
  }else{gs.style.display='flex';us.style.display='none';}
}

/* ═══ ADMIN ═══ */
function checkAdminPass(){
  const inp=$('adminPassInput');if(!inp)return;
  const rl=MLS.RL.check('admin','_');
  if(!rl.ok){toast(rl.msg,'err');return;}
  if(MLS.Auth.checkAdmin(inp.value)){
    inp.value='';MLS.RL.reset('admin','_');openAdmin();toast('⚙️ Admin Panel terbuka!','ok');
  }else toast('Password admin salah! ('+rl.rem+' percobaan tersisa)','err');
}
function openAdmin(){renderAdmin();$('adminPanel')?.classList.add('show');document.body.style.overflow='hidden';}
function closeAdmin(){$('adminPanel')?.classList.remove('show');document.body.style.overflow='';}

async function renderAdmin(){
  const users=await MLS.Store.getUsers();
  const rev=await MLS.Store.getRev();
  const views=await MLS.Store.getViews();
  setTxt('aStatUsers',users.length);setTxt('aStatProds',ST.products.length);
  setTxt('aStatRev',fmtRp(rev));setTxt('aStatVch',ST.vouchers.length);setTxt('aStatViews',views);

  const vl=$('admVchrList');
  if(vl) vl.innerHTML=ST.vouchers.map(v=>`
    <div class="adm-row">
      <div class="adm-code">${MLS.San.html(v.code)}</div>
      <div class="adm-vinfo">
        <div class="adm-vname">${MLS.San.html(v.desc)}</div>
        <div class="adm-vmeta">${v.type==='pct'?v.value+'% off':'Rp '+v.value.toLocaleString()+' off'} · Min ${fmtRp(v.minBuy)} · Exp: ${MLS.San.html(v.exp)} · ${v.used||0} dipakai</div>
      </div>
      <button class="adm-tog ${v.active?'on':'off'}" onclick="ML.toggleVoucher('${MLS.San.html(v.id)}')">${v.active?'✓ Aktif':'✗ Nonaktif'}</button>
    </div>`).join('');

  const pl=$('admProdList');
  if(pl) pl.innerHTML=ST.products.map(p=>`
    <div class="adm-row">
      <img class="adm-prod-img" src="${p.steamImg}" alt="${MLS.San.html(p.name)}"
        onerror="this.onerror=null;this.src='${p.localImage}'">
      <div class="adm-vinfo">
        <div class="adm-vname">${MLS.San.html(p.name)}</div>
        <div class="adm-vmeta">${MLS.San.html(p.developer)} · ${p.genre.slice(0,2).join(', ')} · ${MLS.San.html(p.size)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="color:var(--g50);font-weight:700;font-size:.87rem">${fmtRp(p.price)}</div>
        ${p.discount>0?`<div style="color:var(--red);font-size:.7rem">-${p.discount}%</div>`:''}
      </div>
    </div>`).join('');
}

async function addVoucher(){
  const g=id=>$(id)?.value.trim()||'';
  const code=g('nvCode').toUpperCase(),type=g('nvType'),
        val=parseInt(g('nvValue')),minBuy=parseInt(g('nvMin'))||0,
        desc=g('nvDesc'),exp=g('nvExp')||'2027-12-31';
  if(!MLS.Val.voucherCode(code)){toast('Kode tidak valid (3-20 karakter kapital/angka)','err');return;}
  if(!MLS.Val.posInt(val+'')){toast('Nilai tidak valid','err');return;}
  if(ST.vouchers.find(v=>v.code===code)){toast('Kode sudah digunakan','err');return;}
  const nv={id:'cv_'+MLS.randHex(6),code,type,value:val,minBuy,
            maxSave:type==='pct'?val*10000:val,desc:desc||'Voucher '+code,
            exp,active:true,limit:9999,used:0,custom:true};
  ST.vouchers.push(nv);
  const cv=await MLS.Store.getVcustom();cv.push(nv);await MLS.Store.setVcustom(cv);
  renderAdmin();renderVoucherCards();
  ['nvCode','nvValue','nvMin','nvDesc','nvExp'].forEach(id=>{const e=$(id);if(e)e.value='';});
  toast('🎟️ Voucher <b>'+MLS.San.html(code)+'</b> berhasil ditambahkan!','ok');
}

async function toggleVoucher(id){
  const i=ST.vouchers.findIndex(v=>v.id===id);if(i<0)return;
  ST.vouchers[i].active=!ST.vouchers[i].active;
  if(ST.vouchers[i].custom){
    const cv=await MLS.Store.getVcustom();
    const ci=cv.findIndex(v=>v.id===id);
    if(ci>=0){cv[ci].active=ST.vouchers[i].active;await MLS.Store.setVcustom(cv);}
  }
  renderAdmin();renderVoucherCards();
  toast('Voucher '+(ST.vouchers[i].active?'diaktifkan':'dinonaktifkan'));
}

/* ═══ PROFILE ═══ */
async function renderProfile(){
  if(!ST.user)return;
  const users=await MLS.Store.getUsers();
  const u=users.find(x=>x.email===ST.user.email)||ST.user;
  ST.user=u;
  const pts=u.points||0,lvl=Math.floor(pts/500)+1,pct=(pts%500)/500*100;
  setTxt('profAvChar',(u.name||'U').charAt(0).toUpperCase());
  setTxt('profName',MLS.San.html(u.name||'—'));
  setTxt('profEmail',MLS.San.html(u.email||'—'));
  setTxt('profLvlBadge','Level '+lvl);
  setTxt('profPtsNum',pts.toLocaleString('id-ID'));
  const pb=$('profLvlBar');if(pb)pb.style.width=pct+'%';
  const streak=await MLS.Store.getStreak();
  const rev=await MLS.Store.getRev();
  setTxt('ovPts',pts.toLocaleString('id-ID'));
  setTxt('ovBuys',(u.purchases||[]).length);
  setTxt('ovAchs',(u.achievements||[]).length);
  setTxt('ovWish',ST.wish.length);
  setTxt('ovStreak',streak.count||0);
  setTxt('ovSpend',fmtRp(rev));
  renderAchievements(u);
  await renderMissions(u);
  renderPurchaseHistory(u);
}

function renderAchievements(u){
  const g=$('achGrid');if(!g)return;
  const done=u.achievements||[];
  const rc={common:'var(--w50)',rare:'var(--g50)',epic:'#9966ff'};
  g.innerHTML=ST.achievements.map(a=>`
    <div class="ach-card${done.includes(a.id)?' done':' locked'}">
      <div class="ach-ico">${a.icon}</div>
      <div class="ach-text">
        <div class="ach-name" style="color:${rc[a.rarity]||'var(--w70)'}">${MLS.San.html(a.name)}</div>
        <div class="ach-desc">${MLS.San.html(a.description||a.desc)}</div>
        <div class="ach-pts">+${a.pts} pts ${done.includes(a.id)?'· ✅ Selesai':'· 🔒 Terkunci'}</div>
      </div>
    </div>`).join('');
}

async function renderMissions(u){
  const list=$('misList');if(!list)return;
  const mp=await MLS.Store.getMisProg();
  list.innerHTML=ST.missions.map(m=>{
    const prog=getMissionProg(m,u,mp),pct=Math.min(100,Math.round(prog/m.req*100));
    return `<div class="mis-item">
      <div class="mis-ico">${m.icon}</div>
      <div class="mis-info">
        <div class="mis-name">${MLS.San.html(m.name)} <span class="mis-badge">${m.mtype}</span></div>
        <div class="mis-desc">${MLS.San.html(m.desc)}</div>
        <div class="mis-reward">🎁 ${m.rewardType==='voucher'?'Voucher: '+m.reward:'+'+m.reward+' pts'}</div>
      </div>
      <div class="mis-prog">
        <div class="mis-txt">${Math.min(prog,m.req)}/${m.req}</div>
        <div class="mis-bar"><div class="mis-fill" style="width:${pct}%"></div></div>
        ${pct>=100?'<div class="mis-done">✓</div>':''}
      </div>
    </div>`;
  }).join('');
}

function getMissionProg(m,u,mp){
  switch(m.ctype){
    case 'login':   return 1;
    case 'view':    return ST.viewedToday;
    case 'purchase':return(u.purchases||[]).length;
    case 'wishlist':return ST.wish.length;
    case 'spend':   return mp['spend']||0;
    default:        return mp[m.id]||0;
  }
}

function renderPurchaseHistory(u){
  const g=$('purchGrid');if(!g)return;
  const items=[...new Set(u.purchases||[])].map(id=>ST.products.find(p=>p.id===id)).filter(Boolean);
  if(!items.length){
    g.innerHTML=`<div class="empty-state"><div class="empty-ico">🎮</div><p>Belum ada pembelian. Yuk mulai berbelanja!</p></div>`;
    return;
  }
  g.innerHTML='<div class="prod-grid">'+items.map(prodCard).join('')+'</div>';
  observeReveal();
}

function switchProfTab(t){
  $$('.prof-tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===t));
  $$('.prof-pane').forEach(el=>el.classList.toggle('active',el.dataset.tab===t));
}

/* ═══ ACHIEVEMENTS ═══ */
async function checkAch(type){
  if(!ST.user)return;
  const u=ST.user,done=u.achievements||[];let anyNew=false;
  for(const a of ST.achievements){
    if(done.includes(a.id))continue;
    let prog=0;
    if(a.type==='purchase'&&(type==='purchase'||type==='all'))prog=(u.purchases||[]).length;
    else if(a.type==='cart'&&type==='cart')prog=ST.cart.length;
    else if(a.type==='wishlist'&&type==='wishlist')prog=ST.wish.length;
    else if(a.type==='review'&&type==='review')prog=Object.keys(ST.prodRatings).length;
    else if(a.type==='voucher'&&type==='voucher')prog=ST.appliedVoucher?1:0;
    else if(a.type==='spend'&&type==='spend')prog=await MLS.Store.getRev();
    if(prog>=a.req){done.push(a.id);anyNew=true;
      setTimeout(()=>toast('🏆 Achievement: <b>'+MLS.San.html(a.name)+'</b>! +'+a.pts+' pts','ok'),600);}
  }
  if(anyNew){
    u.achievements=done;ST.user=u;
    const users=await MLS.Store.getUsers();
    const ui=users.findIndex(x=>x.email===u.email);
    if(ui>=0){users[ui].achievements=done;await MLS.Store.setUsers(users);}
  }
}

/* ═══ WEB RATING ═══ */
async function rateWeb(v){
  const wr=await MLS.Store.getWebR();
  wr.total+=v;wr.count+=1;
  await MLS.Store.setWebR(wr);ST.webRating=wr;
  updateWebRatingDisplay();
  toast('⭐ Rating '+v+'/5 tersimpan! Terima kasih 🙏','ok');
}
function updateWebRatingDisplay(){
  const el=$('wrDisplay');if(!el)return;
  if(ST.webRating.count>0){
    const avg=ST.webRating.total/ST.webRating.count;
    el.innerHTML=starsHTML(avg)+' <span class="wr-num">'+avg.toFixed(1)+'</span> <span class="wr-cnt">'+ST.webRating.count+' penilaian</span>';
  }else el.innerHTML='<span style="color:var(--w40)">Jadilah yang pertama memberi rating!</span>';
}

/* ═══ SEARCH ═══ */
function doSearch(q){
  const drop=$('searchDrop');if(!drop)return;
  q=(q||'').toLowerCase().trim();
  if(!q){drop.classList.remove('show');return;}
  const res=ST.products.filter(p=>
    p.name.toLowerCase().includes(q)||p.developer.toLowerCase().includes(q)||
    p.genre.some(g=>g.toLowerCase().includes(q))||(p.tags||[]).some(tg=>tg.toLowerCase().includes(q))
  ).slice(0,6);
  if(!res.length){
    drop.innerHTML='<div class="sdrop-empty">Tidak ada hasil untuk "<b>'+MLS.San.html(q)+'</b>"</div>';
    drop.classList.add('show');return;
  }
  drop.innerHTML=res.map(p=>`
    <button class="sdrop-item" onclick="ML.openProd(${p.id});document.getElementById('searchDrop').classList.remove('show');document.getElementById('searchInput').value=''">
      <img src="${p.steamImg}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${p.localImage}'">
      <div class="sdrop-info">
        <div class="sdrop-name">${MLS.San.html(p.name)}</div>
        <div class="sdrop-dev">${MLS.San.html(p.developer)}</div>
      </div>
      <span class="sdrop-price">${fmtRp(p.price)}</span>
    </button>`).join('');
  drop.classList.add('show');
}

/* ═══ NAVIGATION ═══ */
function goPage(page){
  ST.page=page;
  $$('.ml-page').forEach(p=>p.classList.remove('active'));
  const el=$('pg-'+page);if(el)el.classList.add('active');
  $$('.nav-link').forEach(l=>l.classList.toggle('active',l.dataset.page===page));
  $$('.mob-nav-link').forEach(l=>l.classList.toggle('active',l.dataset.page===page));
  $('mobNav')?.classList.remove('show');
  $('hdMenuBtn')?.classList.remove('open');
  document.body.style.overflow='';
  if(page==='wishlist')renderWishPage();
  if(page==='profile'){if(!ST.user){openAuth();return;}renderProfile();}
  if(page==='deals')renderVoucherCards();
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(observeReveal,100);
}

function filterCat(cat){
  ST.catFilter=cat;
  $$('.cat-pill').forEach(p=>p.classList.toggle('active',p.dataset.cat===cat));
  renderStoreGrid();
}

function toggleMobNav(){
  const nav=$('mobNav'),btn=$('hdMenuBtn');if(!nav||!btn)return;
  const open=nav.classList.toggle('show');
  btn.classList.toggle('open',open);
  document.body.style.overflow=open?'hidden':'';
}

/* ═══ SCROLL + REVEAL ═══ */
function scrollFX(){
  const hd=document.querySelector('.ml-header');
  window.addEventListener('scroll',()=>hd?.classList.toggle('scrolled',scrollY>18),{passive:true});
}

function observeReveal(){
  if(!window.IntersectionObserver)return;
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
  },{threshold:.07,rootMargin:'0px 0px -10px 0px'});
  $$('.reveal:not(.in),.reveal-left:not(.in),.reveal-right:not(.in)').forEach(el=>io.observe(el));
}

/* ═══ PARTICLES ═══ */
function spawnParticles(){
  const cv=$('ptcl');if(!cv)return;
  const ctx=cv.getContext('2d');
  const resize=()=>{cv.width=innerWidth;cv.height=innerHeight;};
  resize();on(window,'resize',resize,{passive:true});
  const n=window.innerWidth<768?30:60;
  const pts=Array.from({length:n},()=>({
    x:Math.random()*innerWidth,y:Math.random()*innerHeight,
    r:Math.random()*1.1+.2,vx:(Math.random()-.5)*.22,vy:(Math.random()-.5)*.22,
    o:Math.random()*.25+.05,
  }));
  const frame=()=>{
    ctx.clearRect(0,0,cv.width,cv.height);
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=cv.width;if(p.x>cv.width)p.x=0;
      if(p.y<0)p.y=cv.height;if(p.y>cv.height)p.y=0;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(201,168,76,'+p.o+')';ctx.fill();
    });
    requestAnimationFrame(frame);
  };
  frame();
}

/* ═══ TOAST ═══ */
function toast(msg,type=''){
  const wrap=$('toastWrap');if(!wrap)return;
  const colors={ok:'var(--green)',err:'var(--red)','':`var(--g50)`};
  const icons={ok:'✓',err:'✕','':'i'};
  const c=colors[type]||colors[''],ic=icons[type]||'i';
  const el=document.createElement('div');
  el.className='toast-item';
  el.style.cssText='border-left:3px solid '+c;
  el.innerHTML='<span class="toast-ico" style="background:'+c+'22;color:'+c+'">'+ic+'</span>'
    +'<span class="toast-msg">'+msg+'</span>';
  wrap.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('in'));
  setTimeout(()=>{el.classList.remove('in');setTimeout(()=>el.remove(),350);},3200);
}

/* ═══ BIND ═══ */
function bindAll(){
  // Search
  const si=$('searchInput');
  if(si){
    on(si,'input',e=>doSearch(e.target.value));
    on(si,'keydown',e=>{if(e.key==='Escape')$('searchDrop')?.classList.remove('show');});
  }
  // Click outside
  on(document,'click',e=>{
    if(!e.target.closest('.search-wrap'))$('searchDrop')?.classList.remove('show');
    if(!e.target.closest('.hd-user-wrap')&&e.target.id!=='hdAvatar')$('userDrop')?.classList.remove('show');
    if(!e.target.closest('#mobNav')&&!e.target.closest('#hdMenuBtn')){
      $('mobNav')?.classList.remove('show');
      $('hdMenuBtn')?.classList.remove('open');
      if(document.body.style.overflow==='hidden'&&!$('authModal')?.classList.contains('show')&&
         !$('prodModal')?.classList.contains('show')&&!$('adminPanel')?.classList.contains('show')&&
         !$('cartSidebar')?.classList.contains('open'))
        document.body.style.overflow='';
    }
  });
  // Avatar
  on($('hdAvatar'),'click',e=>{e.stopPropagation();$('userDrop')?.classList.toggle('show');});
  // Mobile menu
  on($('hdMenuBtn'),'click',e=>{e.stopPropagation();toggleMobNav();});
  // Auth forms
  $('loginForm')?.addEventListener('submit',handleLogin);
  $('regForm')?.addEventListener('submit',handleRegister);
  $$('.auth-tab').forEach(t=>on(t,'click',()=>switchAuthTab(t.dataset.tab)));
  // Password strength
  on($('rgPass'),'input',e=>updatePassStrength(e.target.value));
  // Modal backdrops
  on($('prodModal'),'click',e=>{if(e.target===$('prodModal'))closeProdModal();});
  on($('authModal'),'click',e=>{if(e.target===$('authModal'))closeAuth();});
  // ESC
  on(document,'keydown',e=>{if(e.key==='Escape'){closeProdModal();closeAuth();closeAdmin();closeCart();}});
  // Web rating
  $$('.wr-star').forEach((btn,i)=>{
    on(btn,'click',()=>{$$('.wr-star').forEach((s,j)=>s.classList.toggle('on',j<=i));rateWeb(i+1);});
    on(btn,'mouseenter',()=>$$('.wr-star').forEach((s,j)=>s.classList.toggle('hov',j<=i)));
    on(btn,'mouseleave',()=>$$('.wr-star').forEach(s=>s.classList.remove('hov')));
  });
  // FAQ
  on(document,'click',e=>{
    const tog=e.target.closest('.faq-toggle');if(!tog)return;
    const item=tog.closest('.faq-item');
    const was=item.classList.contains('open');
    $$('.faq-item').forEach(fi=>fi.classList.remove('open'));
    if(!was)item.classList.add('open');
  });
  // Touch swipe: cart sidebar
  const cart=$('cartSidebar');
  if(cart){
    let sx=0;
    on(cart,'touchstart',e=>{sx=e.touches[0].clientX;},{passive:true});
    on(cart,'touchend',e=>{if(e.changedTouches[0].clientX-sx>60)closeCart();},{passive:true});
  }
  // Touch swipe: modal
  const modal=$('prodModal');
                if(modal){
    let sy=0;
    on(modal,'touchstart',e=>{sy=e.touches[0].clientY;},{passive:true});
    on(modal,'touchend',e=>{if(e.changedTouches[0].clientY-sy>100)closeProdModal();},{passive:true});
  }
}

/* ═══ PUBLIC API ═══ */
window.ML={
  boot,goPage,openProd,closeProdModal,
  addCart,removeCart,openCart,closeCart,applyVoucher,checkout,
  toggleWish,
  openAuth,closeAuth,switchAuthTab,handleGoogle,handleLogout,
  checkAdminPass,openAdmin,closeAdmin,addVoucher,toggleVoucher,
  filterCat,heroSlide,switchProfTab,toggleMobNav,
  rateWeb,copyVoucher,toast,
};

document.addEventListener('DOMContentLoaded',boot);
})();
  
