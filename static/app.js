(() => {
  "use strict";

  const API = "";
  const PAGE_SIZE = 24;

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
  const favToggle = document.getElementById("favToggle");
  const favCount = document.getElementById("favCount");
  const backdrop = document.getElementById("modalBackdrop");
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");

  const state = {
    items: [], total: 0, offset: 0, loading: false,
    activeType: null, query: "", favOnly: false,
    detailCache: new Map(),
  };
  let favorites = new Set();
  try {
    favorites = new Set(JSON.parse(localStorage.getItem("pokedex:favs") || "[]"));
  } catch { favorites = new Set(); }

  const pad3 = (n) => "#" + String(n).padStart(3, "0");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const saveFavs = () => {
    localStorage.setItem("pokedex:favs", JSON.stringify([...favorites]));
    favCount.textContent = favorites.size;
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

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

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
        <div class="sk" style="height:148px;width:148px;border-radius:50%;margin:14px auto 10px"></div>
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
    return `<article class="card" data-id="${p.id}" style="--t1:${c1};--d:${delay}ms" tabindex="0" role="button" aria-label="Ver detalhes de ${p.nome}">
      <span class="card-ghost" aria-hidden="true">${pad3(p.id)}</span>
      <button class="fav-star${isFav ? " active" : ""}" data-fav="${p.id}" aria-label="${isFav ? "Remover" : "Favoritar"} ${p.nome}" aria-pressed="${isFav}" title="Favoritar">${isFav ? "★" : "☆"}</button>
      <div class="card-top"><span class="card-num">${pad3(p.id)}</span></div>
      <div class="card-art"><img class="card-img" loading="lazy" src="${p.imagem || ""}" alt="${p.nome}" onerror="this.style.visibility='hidden'"/></div>
      <div class="card-name">${p.nome}</div>
      <div class="card-types">${p.tipos.map(typeBadge).join("")}</div>
    </article>`;
  }

  function render() {
    let items = state.items;
    if (state.favOnly) items = items.filter((p) => favorites.has(p.id));
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
        ? `${state.total} Pokémon do tipo ${state.activeType} · mostrando ${items.length}`
        : `${state.total} Pokémon · mostrando ${items.length}`;
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
      render();
    } catch (e) {
      state.loading = false;
      grid.innerHTML = "";
      setStatus("error", e.message + " Verifique sua conexão e tente novamente.");
    }
  }

  const doSearch = async (raw) => {
    const q = raw.trim().toLowerCase();
    state.query = q;
    searchClear.hidden = !q;
    if (!q) { state.activeType = null; syncChips(); loadPage(true); return; }
    skeletons(1); setStatus("grid"); grid.style.display = "";
    resultMeta.textContent = `Buscando “${q}”…`;
    try {
      const p = await api(`/api/pokemon/${encodeURIComponent(q)}`);
      state.items = [{
        id: p.id, nome: p.nome, tipos: p.tipos, imagem: p.imagem,
        _full: p,
      }];
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

  // ---- Modal ----
  let lastOpener = null;

  function statBar(nome, valor) {
    const pct = Math.min(100, Math.round((valor / 200) * 100));
    return `<div class="stat-row"><span>${STAT_LABELS[nome] || nome}</span>
      <div class="stat-bar" role="img" aria-label="${STAT_LABELS[nome] || nome}: ${valor}"><i data-w="${pct}"></i></div><strong>${valor}</strong></div>`;
  }

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
    // foco acessível
    document.getElementById("modalClose").focus();
    try {
      let p = state.items.find((x) => String(x.id) === String(id) && x._full)?._full
        || state.detailCache.get(String(id));
      if (!p) { p = await api(`/api/pokemon/${id}`); state.detailCache.set(String(id), p); }
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
            <div class="meta"><small>Habilidades</small><strong>${p.habilidades.map(cap).join(", ") || "—"}</strong></div>
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

  // ---- Events ----
  grid.addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) {
      e.stopPropagation();
      const id = Number(favBtn.dataset.fav);
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      saveFavs();
      render();
      // mantém o foco no botão correspondente após o re-render
      const novo = grid.querySelector(`[data-fav="${id}"]`);
      if (novo) novo.focus();
      return;
    }
    const card = e.target.closest(".card");
    if (card) openDetail(card.dataset.id);
  });

  grid.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) {
      e.preventDefault();
      openDetail(e.target.dataset.id);
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
  searchClear.addEventListener("click", () => {
    searchInput.value = ""; doSearch("");
  });

  filtersEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.query = ""; searchInput.value = ""; searchClear.hidden = true;
    state.activeType = chip.dataset.type || null;
    state.favOnly = false; favToggle.setAttribute("aria-pressed", "false");
    syncChips();
    loadPage(true);
  });

  loadMoreBtn.addEventListener("click", () => loadPage(false));
  document.getElementById("errorRetry").addEventListener("click", () => loadPage(true));
  document.getElementById("emptyReset").addEventListener("click", () => {
    searchInput.value = ""; state.query = ""; state.activeType = null;
    state.favOnly = false; favToggle.setAttribute("aria-pressed", "false");
    syncChips(); loadPage(true);
  });
  document.getElementById("brandHome").addEventListener("click", (e) => {
    e.preventDefault();
    searchInput.value = ""; state.query = ""; state.activeType = null;
    state.favOnly = false; favToggle.setAttribute("aria-pressed", "false");
    syncChips(); loadPage(true); window.scrollTo({ top: 0, behavior: "smooth" });
  });

  favToggle.addEventListener("click", () => {
    state.favOnly = !state.favOnly;
    favToggle.setAttribute("aria-pressed", String(state.favOnly));
    render();
  });

  document.getElementById("modalClose").addEventListener("click", closeDetail);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !backdrop.hidden) closeDetail(); });

  // deep-link: #/pokemon/25 funciona após refresh
  function routeFromHash() {
    const m = location.hash.match(/#\/pokemon\/([\w-]+)/);
    if (m) openDetail(m[1]);
    else if (!backdrop.hidden) closeDetail();
  }

  // init
  saveFavs();
  loadTypes();
  window.addEventListener("hashchange", routeFromHash);
  loadPage(true).then(routeFromHash);
})();
