function prodCard(p){
  const wished=ST.wish.includes(p.id);
  const avg=avgRating(p.id,p.rating);
  // Prioritize beautiful Steam header images (like Steam store)
  const mainImg = p.steamImg || p.localImage;
  return `
  <article class="prod-card reveal" onclick="ML.openProd(${p.id})">
    <div class="prod-thumb">
      <img src="${mainImg}" alt="${MLS.San.html(p.name)}" loading="lazy"
        onerror="this.onerror=null;this.src='${p.localImage || p.steamImg}'">
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