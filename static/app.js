(() => {
  "use strict";

  const API = "";
  const PAGE_SIZE = 24;
  const DEFAULT_HERO = 6; // Charizard como destaque inicial

  const TYPE_COLORS = {
    normal: "#A8A77A", fire: "#EE8130", water: "#6390F0", electric: "#F7D02C",
    grass: "#7AC74C", ice: "#96D9D6", fighting: "#C22E28", poison: "#A33EA1",
    ground: "#E2BF65", flying: "#A98FF3", psychic: "#F95587", bug: "#A6B91A",
    rock: "#B6A136", ghost: "#735797", dragon: "#6F35FC", dark: "#705746",
    steel: "#B7B7CE", fairy: "#D685AD",
  };
  const STAT_LABELS = {
    hp: "HP", attack: "Ataque", defense: "Defesa", "special-attack": "Atq. Esp.",
    "special-defense": "Def. Esp.", speed: "Velocidade",
  };
  const SORTERS = {
    "id-asc": (a, b) => a.id - b.id,
    "id-desc": (a, b) => b.id - a.id,
    "name-asc": (a, b) => a.nome.localeCompare(b.nome, "pt"),
    "name-desc": (a, b) => b.nome.localeCompare(a.nome, "pt"),
  };

  // elementos
  const grid = document.getElementById("grid");
  const resultMeta = document.getElementById("resultMeta");
  const loadMoreBtn = document.getElementById("loadMore");
  const loadMoreWrap = document.getElementById("loadMoreWrap");
  const searchInput = document.getElementById("searchInput");
  const searchClear = document.getElementById("searchClear");
  const filtersEl = document.getElementById("typeFilters");
  const emptyState = document.getElementById("emptyState");
  const emptyText = document.getElementById("emptyText");
  const errorState = document.getElementById("errorState");
  const errorText = document.getElementById("errorText");
  const navFavs = document.getElementById("navFavs");
  const navExplore = document.getElementById("navExplore");
  const navTypes = document.getElementById("navTypes");
  const favToggle = document.getElementById("favToggle");
  const totalInfo = document.getElementById("totalInfo");
  const sortSelect = document.getElementById("sortSelect");
  const backdrop = document.getElementById("modalBackdrop");
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");
  const hero = document.getElementById("hero");
  const heroNum = document.getElementById("heroNum");
  const heroName = document.getElementById("heroName");
  const heroTypes = document.getElementById("heroTypes");
  const heroDesc = document.getElementById("heroDesc");
  const heroHeight = document.getElementById("heroHeight");
  const heroWeight = document.getElementById("heroWeight");
  const heroImg = document.getElementById("heroImg");
  const heroTotal = document.getElementById("heroTotal");
  const heroStats = document.getElementById("heroStats");
  const heroDetails = document.getElementById("heroDetails");
  const heroFav = document.getElementById("heroFav");
  const moreInfo = document.getElementById("moreInfo");

  const state = {
    items: [], total: 0, offset: 0, loading: false,
    activeType: null, query: "", favOnly: false, sort: "id-asc",
    heroId: null, hero: null,
    detailCache: new Map(),
  };
  let favorites = new Set();
  try {
    favorites = new Set(JSON.parse(localStorage.getItem("pokedex:favs") || "[]"));
  } catch { favorites = new Set(); }

  const pad3 = (n) => "#" + String(n).padStart(3, "0");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const isDesktop = () => window.matchMedia("(min-width: 769px)").matches;
  const saveFavs = () => {
    localStorage.setItem("pokedex:favs", JSON.stringify([...favorites]));
    document.querySelectorAll(".fav-count").forEach((el) => { el.textContent = favorites.size; });
  };

  async function api(path) {
    const r = await fetch(API + path);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      const err = new Error(body.detail || ("Erro HTTP " + r.status));
      err.status = r.status;
      throw err;
    }
    return r.json();
  }

  const show = (el) => { el.hidden = false; };
  const hide = (el) => { el.hidden = true; };

  function setStatus(mode, message) {
    hide(emptyState); hide(errorState);
    grid.style.display = mode === "grid" ? "" : "none";
    loadMoreWrap.hidden = !(mode === "grid" && canLoadMore());
    if (mode === "empty") { show(emptyState); if (message) emptyText.textContent = message; }
    if (mode === "error") { show(errorState); if (message) errorText.textContent = message; }
  }

  function canLoadMore() {
    if (state.query || state.favOnly) return false;
    return state.items.length < state.total;
  }

  function skeletons(n = 8) {
    grid.innerHTML = Array.from({ length: n }, () =>
      `<div class="card skeleton" aria-hidden="true">
        <div class="sk" style="height:14px;width:34%"></div>
        <div class="sk" style="height:150px;width:150px;border-radius:50%;margin:14px auto 10px"></div>
        <div class="sk" style="height:22px;width:64%;margin:0 auto 10px"></div>
        <div class="sk" style="height:24px;width:82%;margin:0 auto"></div>
      </div>`
    ).join("");
  }

  function typeBadge(t) {
    const c = TYPE_COLORS[t] || "#cbd5e1";
    return `<span class="type-badge" style="--c:${c}">${t}</span>`;
  }

  function cardHTML(p, delay = 0) {
    const c1 = TYPE_COLORS[p.tipos[0]] || "#475569";
    const isFav = favorites.has(p.id);
    const isHero = Number(p.id) === Number(state.heroId);
    return `<article class="card${isHero ? " selected" : ""}" data-id="${p.id}" style="--t1:${c1};--d:${delay}ms"
      tabindex="0" role="button" ${isHero ? 'aria-current="true"' : ""} aria-label="Ver detalhes de ${p.nome}">
      <span class="card-ghost" aria-hidden="true">${pad3(p.id)}</span>
      <button class="fav-star${isFav ? " active" : ""}" data-fav="${p.id}" aria-pressed="${isFav}" aria-label="${isFav ? "Remover" : "Favoritar"} ${p.nome}" title="Favoritar">${isFav ? "★" : "☆"}</button>
      <div class="card-top"><span class="card-num">${pad3(p.id)}</span></div>
      <div class="card-art"><img class="card-img" loading="lazy" src="${p.imagem || ""}" alt="${p.nome}" onerror="this.style.visibility='hidden'"/></div>
      <div class="card-name">${p.nome}</div>
      <div class="card-types">${p.tipos.map(typeBadge).join("")}</div>
    </article>`;
  }

  function visibleItems() {
    let items = state.items;
    if (state.favOnly) items = items.filter((p) => favorites.has(p.id));
    return [...items].sort(SORTERS[state.sort] || SORTERS["id-asc"]);
  }

  function render() {
    const items = visibleItems();
    if (!items.length) {
      setStatus("empty", state.favOnly
        ? "Você ainda não favoritou nenhum Pokémon. Toque na estrela de um card."
        : undefined);
      resultMeta.textContent = "";
      return;
    }
    setStatus("grid");
    grid.innerHTML = items.map((p, i) => cardHTML(p, (i % 12) * 45)).join("");
    resultMeta.textContent = state.query
      ? `Resultado para “${state.query}”`
      : state.activeType
        ? `${state.total} do tipo ${state.activeType} · ${items.length} em tela`
        : `${state.total.toLocaleString("pt-BR")} Pokémon · ${items.length} em tela`;
    loadMoreWrap.hidden = !canLoadMore();
  }

  async function loadPage(reset = false) {
    if (state.loading) return;
    state.loading = true;
    if (reset) { state.items = []; state.offset = 0; skeletons(); setStatus("grid"); grid.style.display = ""; }
    try {
      const q = state.activeType
        ? `/api/pokemon?limit=${PAGE_SIZE}&offset=${state.offset}&type=${encodeURIComponent(state.activeType)}`
        : `/api/pokemon?limit=${PAGE_SIZE}&offset=${state.offset}`;
      const data = await api(q);
      state.total = data.total;
      state.items = state.items.concat(data.resultados);
      state.offset += data.resultados.length;
      state.loading = false;
      if (totalInfo) totalInfo.textContent = state.total.toLocaleString("pt-BR");
      render();
    } catch (e) {
      state.loading = false;
      grid.innerHTML = "";
      setStatus("error", e.message + " Verifique sua conexão e tente novamente.");
    }
  }

  /* ================= Hero / Pokémon em destaque ================= */
  function statBar(nome, valor) {
    const pct = Math.min(100, Math.round((valor / 200) * 100));
    return `<div class="stat-row"><span>${STAT_LABELS[nome] || nome}</span>
      <div class="stat-bar" role="img" aria-label="${STAT_LABELS[nome] || nome}: ${valor}"><i data-w="${pct}"></i></div><strong>${valor}</strong></div>`;
  }

  function renderHero(p) {
    hero.classList.remove("loading");
    heroNum.textContent = pad3(p.id);
    heroName.textContent = p.nome;
    heroTypes.innerHTML = p.tipos.map(typeBadge).join("");
    heroDesc.textContent = p.descricao || "Sem descrição disponível para este Pokémon.";
    heroHeight.textContent = (p.altura / 10).toFixed(1).replace(".", ",") + " m";
    heroWeight.textContent = (p.peso / 10).toFixed(1).replace(".", ",") + " kg";
    heroImg.src = p.imagem || "";
    heroImg.alt = p.nome;
    heroImg.onerror = () => { heroImg.style.visibility = "hidden"; };
    heroImg.onload = () => { heroImg.style.visibility = "visible"; };
    hero.style.setProperty("--t1", TYPE_COLORS[p.tipos[0]] || "#406ef0");
    hero.style.setProperty("--t2", TYPE_COLORS[p.tipos[1]] || TYPE_COLORS[p.tipos[0]] || "#406ef0");
    const total = (p.stats || []).reduce((s, x) => s + (x.valor || 0), 0);
    heroTotal.textContent = total ? "Total " + total : "—";
    heroStats.innerHTML = (p.stats || []).map((s) => statBar(s.nome, s.valor)).join("");
    requestAnimationFrame(() =>
      heroStats.querySelectorAll(".stat-bar i").forEach((el) => { el.style.width = el.dataset.w + "%"; }));
    updateHeroFav();
  }

  function updateHeroFav() {
    if (!state.heroId) return;
    const isFav = favorites.has(Number(state.heroId));
    heroFav.classList.toggle("active", isFav);
    heroFav.setAttribute("aria-pressed", String(isFav));
    heroFav.textContent = isFav ? "★" : "☆";
    heroFav.setAttribute("aria-label", `${isFav ? "Remover" : "Favoritar"} ${state.hero?.nome || "Pokémon"} dos favoritos`);
  }

  function markSelected() {
    grid.querySelectorAll(".card").forEach((c) => {
      const on = Number(c.dataset.id) === Number(state.heroId);
      c.classList.toggle("selected", on);
      if (on) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current");
    });
  }

  async function setHero(id) {
    id = Number(id);
    if (!id || id === state.heroId) return;
    state.heroId = id;
    hero.classList.add("loading");
    markSelected();
    try {
      let p = state.detailCache.get(String(id));
      if (!p) {
        p = await api(`/api/pokemon/${id}`);
        state.detailCache.set(String(id), p);
        state.detailCache.set(p.nome.toLowerCase(), p);
      }
      if (state.heroId !== id) return; // outra seleção mais recente venceu
      state.hero = p;
      renderHero(p);
    } catch (e) {
      if (state.heroId === id) {
        state.heroId = null;
        hero.classList.remove("loading");
        markSelected();
      }
      throw e;
    }
  }

  function maybeScrollToHero() {
    const r = hero.getBoundingClientRect();
    const visible = r.bottom > 60 && r.top < window.innerHeight;
    if (!visible) hero.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ================= Busca ================= */
  const doSearch = async (raw) => {
    const q = raw.trim().toLowerCase();
    state.query = q;
    searchClear.hidden = !q;
    if (!q) { state.activeType = null; syncChips(); loadPage(true); return; }
    skeletons(1); setStatus("grid"); grid.style.display = "";
    resultMeta.textContent = `Buscando “${q}”…`;
    try {
      const p = await api(`/api/pokemon/${encodeURIComponent(q)}`);
      state.items = [{ id: p.id, nome: p.nome, tipos: p.tipos, imagem: p.imagem, _full: p }];
      state.total = 1;
      state.detailCache.set(String(p.id), p);
      state.detailCache.set(p.nome.toLowerCase(), p);
      render();
    } catch (e) {
      state.items = [];
      setStatus("empty", e.status === 404
        ? `Nenhum Pokémon chamado “${q}”. Confira a grafia ou tente o número (ex: 25).`
        : e.message);
      resultMeta.textContent = "";
    }
  };
  const debouncedSearch = debounce(doSearch, 450);

  /* ================= Filtros ================= */
  async function loadTypes() {
    try {
      const data = await api("/api/types");
      const all = [{ nome: "todos" }, ...data.resultados];
      filtersEl.innerHTML = all.map((t) =>
        t.nome === "todos"
          ? `<button class="chip" data-type="" aria-pressed="${!state.activeType}">Todos</button>`
          : `<button class="chip" data-type="${t.nome}" aria-pressed="${state.activeType === t.nome}" style="--chip:${TYPE_COLORS[t.nome] || "#fff"}"><span class="chip-dot" style="--dot:${TYPE_COLORS[t.nome] || "#94a3b8"}" aria-hidden="true"></span>${t.nome}</button>`
      ).join("");
    } catch { filtersEl.innerHTML = ""; }
  }
  function syncChips() {
    filtersEl.querySelectorAll(".chip").forEach((c) => {
      const t = c.dataset.type || null;
      c.setAttribute("aria-pressed", String(state.activeType === t || (!state.activeType && !t)));
    });
  }

  /* ================= Favoritos / navegação ================= */
  function syncFavUi() {
    const on = state.favOnly;
    [navFavs, favToggle].forEach((el) => el && el.setAttribute("aria-pressed", String(on)));
    navExplore.classList.toggle("is-active", !on);
    if (on) navExplore.removeAttribute("aria-current");
    else navExplore.setAttribute("aria-current", "page");
    saveFavs();
    updateHeroFav();
  }

  function resetAll() {
    searchInput.value = "";
    state.query = ""; searchClear.hidden = true;
    state.activeType = null;
    state.favOnly = false;
    syncChips(); syncFavUi();
    loadPage(true);
  }

  /* ================= Modal ================= */
  let lastOpener = null;

  function evoHTML(atual, evolucoes) {
    if (!evolucoes || evolucoes.length < 2) return "";
    const steps = evolucoes.map((e) => {
      const isCurrent = Number(e.id) === Number(atual);
      return `<button class="evo-btn${isCurrent ? " current" : ""}" data-evo="${e.id}"${isCurrent ? ' aria-current="true"' : ` aria-label="Ver ${e.nome}"`} title="${e.nome}">
        <img loading="lazy" src="${e.imagem}" alt="${e.nome}" onerror="this.style.visibility='hidden'"/>
        <small>#${String(e.id).padStart(3, "0")}</small>
        <span>${e.nome}</span>
      </button>`;
    }).join(`<span class="evo-link" aria-hidden="true">→</span>`);
    return `<h3>Evolução</h3><div class="evo-track">${steps}</div>`;
  }

  async function openDetail(id) {
    lastOpener = document.activeElement;
    try { history.replaceState(null, "", `#/pokemon/${id}`); } catch { /* noop */ }
    show(backdrop);
    modalBody.innerHTML = `<p style="color:#fff">Carregando…</p>`;
    document.getElementById("modalClose").focus();
    try {
      let p = state.detailCache.get(String(id));
      if (!p) {
        p = await api(`/api/pokemon/${id}`);
        state.detailCache.set(String(id), p);
        state.detailCache.set((p.nome || "").toLowerCase(), p);
      }
      const c1 = TYPE_COLORS[p.tipos[0]] || "#475569";
      modal.style.setProperty("--t1", c1);
      const alturaM = (p.altura / 10).toFixed(1).replace(".", ",");
      const pesoKg = (p.peso / 10).toFixed(1).replace(".", ",");
      const total = (p.stats || []).reduce((s, x) => s + (x.valor || 0), 0);
      modalBody.innerHTML = `
      <div class="detail">
        <section class="detail-hero" aria-label="Apresentação de ${p.nome}">
          <div class="modal-num">${pad3(p.id)}</div>
          <h2 id="modalName">${p.nome}</h2>
          <div class="card-types">${p.tipos.map(typeBadge).join("")}</div>
          <div class="detail-art"><img id="modalImg" src="${p.imagem}" alt="${p.nome}" /></div>
          <button class="btn btn-ghost shiny-toggle" id="shinyBtn">✨ Ver shiny</button>
        </section>
        <section class="detail-info">
          ${p.descricao ? `<p class="modal-desc">${p.descricao}</p>` : ""}
          <div class="meta-grid">
            <div class="meta"><small>Altura</small><strong>${alturaM} m</strong></div>
            <div class="meta"><small>Peso</small><strong>${pesoKg} kg</strong></div>
            <div class="meta"><small>Experiência base</small><strong>${p.experiencia_base ?? "—"}</strong></div>
            <div class="meta"><small>Habilidades</small><strong>${p.habilidades.map((h) => h.split("-").map(cap).join("-")).join(", ") || "—"}</strong></div>
          </div>
          <h3>Stats base <span class="stat-total">Total ${total}</span></h3>
          ${(p.stats || []).map((s) => statBar(s.nome, s.valor)).join("")}
          ${evoHTML(p.id, p.evolucoes)}
        </section>
      </div>`;
      requestAnimationFrame(() =>
        modalBody.querySelectorAll(".stat-bar i").forEach((el) => { el.style.width = el.dataset.w + "%"; }));
      let shiny = false;
      const img = document.getElementById("modalImg");
      document.getElementById("shinyBtn").onclick = () => {
        shiny = !shiny;
        img.src = shiny ? (p.sprite_shiny || p.imagem) : p.imagem;
        document.getElementById("shinyBtn").textContent = shiny ? "Ver normal" : "✨ Ver shiny";
      };
    } catch (e) {
      modalBody.innerHTML = `<h2>Ops…</h2><p>${e.message}</p>`;
    }
  }

  function closeDetail() {
    hide(backdrop);
    try { history.replaceState(null, "", location.pathname); } catch { /* noop */ }
    if (lastOpener && document.contains(lastOpener)) lastOpener.focus();
  }

  /* ================= Events ================= */
  function toggleFav(id) {
    id = Number(id);
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    syncFavUi();
    render();
  }

  function handleCardActivate(card) {
    if (isDesktop()) {
      setHero(card.dataset.id).catch(() => { /* hero já tratou o erro */ });
      maybeScrollToHero();
    } else {
      openDetail(card.dataset.id);
    }
  }

  grid.addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) {
      e.stopPropagation();
      const id = Number(favBtn.dataset.fav);
      toggleFav(id);
      const novo = grid.querySelector(`[data-fav="${id}"]`);
      if (novo) novo.focus();
      return;
    }
    const card = e.target.closest(".card");
    if (card) handleCardActivate(card);
  });

  grid.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) {
      e.preventDefault();
      handleCardActivate(e.target);
    }
  });

  modalBody.addEventListener("click", (e) => {
    const evo = e.target.closest("[data-evo]");
    if (evo) openDetail(evo.dataset.evo);
  });

  searchInput.addEventListener("input", (e) => debouncedSearch(e.target.value));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); doSearch(e.target.value); }
  });
  searchClear.addEventListener("click", () => { searchInput.value = ""; doSearch(""); });

  filtersEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.query = ""; searchInput.value = ""; searchClear.hidden = true;
    state.activeType = chip.dataset.type || null;
    state.favOnly = false; syncFavUi();
    syncChips();
    loadPage(true);
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    render();
  });

  loadMoreBtn.addEventListener("click", () => loadPage(false));
  document.getElementById("errorRetry").addEventListener("click", () => loadPage(true));
  document.getElementById("emptyReset").addEventListener("click", resetAll);

  [document.getElementById("brandHome"), document.getElementById("brandHomeMobile")].forEach((el) => {
    el && el.addEventListener("click", (e) => { e.preventDefault(); resetAll(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  });

  navExplore.addEventListener("click", () => { resetAll(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  const toggleFavOnly = () => {
    state.favOnly = !state.favOnly;
    syncFavUi();
    render();
  };
  navFavs.addEventListener("click", toggleFavOnly);
  favToggle.addEventListener("click", toggleFavOnly);
  navTypes.addEventListener("click", () => {
    document.querySelector(".toolbar").scrollIntoView({ behavior: "smooth", block: "center" });
    const first = filtersEl.querySelector(".chip");
    if (first) setTimeout(() => first.focus(), 350);
  });

  heroDetails.addEventListener("click", () => { if (state.heroId) openDetail(state.heroId); });
  moreInfo.addEventListener("click", () => { if (state.heroId) openDetail(state.heroId); });
  heroFav.addEventListener("click", () => { if (state.heroId) toggleFav(state.heroId); });

  document.getElementById("modalClose").addEventListener("click", closeDetail);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !backdrop.hidden) closeDetail(); });

  function routeFromHash() {
    const m = location.hash.match(/#\/pokemon\/([\w-]+)/);
    if (m) openDetail(m[1]);
    else if (!backdrop.hidden) closeDetail();
  }

  // init
  syncFavUi();
  loadTypes();
  window.addEventListener("hashchange", routeFromHash);
  const boot = loadPage(true).then(routeFromHash);
  setHero(DEFAULT_HERO).catch(() =>
    boot.then(() => state.items[0] && setHero(state.items[0].id).catch(() => {})));
})();
