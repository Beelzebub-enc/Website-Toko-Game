function prodCard(p){
  const wished=ST.wish.includes(p.id);
  const avg=avgRating(p.id,p.rating);
  // STRONGLY prioritize beautiful Steam header images
  const mainImg = p.steamImg || p.localImage || `https://cdn.cloudflare.steamstatic.com/steam/apps/${p.id}/header.jpg`;
  return `
  <article class="prod-card reveal" onclick="ML.openProd(${p.id})">
    <div class="prod-thumb">
      <img src="${mainImg}" alt="${MLS.San.html(p.name)}" loading="lazy"
        onerror="this.onerror=null;this.src='${p.localImage || p.steamImg || `https://cdn.cloudflare.steamstatic.com/steam/apps/${p.id}/header.jpg`}'">
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