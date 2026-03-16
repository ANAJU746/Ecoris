const searchInput = document.getElementById("search-input");
const minInput = document.getElementById("price-min");
const maxInput = document.getElementById("price-max");
const filterButton = document.getElementById("filter-button");
const listElement = document.getElementById("company-list");
const template = document.getElementById("company-card-template");
const userChip = document.getElementById("user-chip");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const userRole = document.getElementById("user-role");
const cartButton = document.getElementById("cart-button");
const cartBadge = document.getElementById("cart-badge");
const cartPanel = document.getElementById("cart-panel");
const cartItems = document.getElementById("cart-items");
const cartClose = document.getElementById("cart-close");
const cartEmpty = document.getElementById("cart-empty");
const cartCheckout = document.getElementById("cart-checkout");
const cartView = document.getElementById("cart-view");
const publishLink = document.getElementById("publish-link");
const profileLink = document.getElementById("profile-link");
const logoutButton = document.getElementById("logout-button");
const recommendationsList = document.getElementById("recommendations-list");
const detailOverlay = document.getElementById("company-detail");
const detailPhoto = document.getElementById("detail-photo");
const detailName = document.getElementById("detail-name");
const detailSubtitle = document.getElementById("detail-subtitle");
const detailLocation = document.getElementById("detail-location");
const detailRegion = document.getElementById("detail-region");
const detailType = document.getElementById("detail-type");
const detailMaterial = document.getElementById("detail-material");
const detailMode = document.getElementById("detail-mode");
const detailAvailability = document.getElementById("detail-availability");
const detailPrice = document.getElementById("detail-price");
const detailTags = document.getElementById("detail-tags");
const detailClose = document.getElementById("detail-close");
const detailContact = document.getElementById("detail-contact");
const detailGoto = document.getElementById("detail-goto");

let cards = [];
let companies = [];
let mapInstance = null;
let mapMarkers = [];
let cart = [];
let detailCompany = null;

const setDetailText = (element, value, fallback = "Sin definir") => {
  if (!element) {
    return;
  }
  const text = value && String(value).trim() ? value : fallback;
  element.textContent = text;
};

const renderDetailLabels = (items = []) => {
  if (!detailTags) {
    return;
  }
  detailTags.innerHTML = "";
  if (!items.length) {
    const span = document.createElement("span");
    span.className = "label";
    span.textContent = "Sin etiquetas";
    detailTags.appendChild(span);
    return;
  }
  items.forEach((label) => {
    const span = document.createElement("span");
    span.className = "label";
    span.textContent = label;
    detailTags.appendChild(span);
  });
};

const closeCompanyDetail = () => {
  if (!detailOverlay) {
    return;
  }
  detailOverlay.classList.remove("is-open");
  detailOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};

const openCompanyDetail = (company) => {
  if (!detailOverlay || !company) {
    return;
  }
  detailCompany = company;
  if (detailPhoto) {
    detailPhoto.src = company.photo || "Logo.png";
    detailPhoto.alt = company.name || "Empresa";
  }
  setDetailText(detailName, company.name, "Empresa");
  const subtitleParts = [company.location, company.state].filter(Boolean);
  setDetailText(detailSubtitle, subtitleParts.join(" · "), "Ubicacion por definir");
  setDetailText(detailLocation, company.location, "Ubicacion por definir");
  setDetailText(detailRegion, company.state, "Estado por definir");
  setDetailText(detailType, company.type, "Tipo no definido");
  setDetailText(detailMaterial, company.material, "Material no definido");
  setDetailText(detailMode, company.mode, "Sin modalidad");
  setDetailText(detailAvailability, company.availability, "Sin disponibilidad registrada");
  setDetailText(detailPrice, company.priceRange, "Precio no disponible");
  const detailLabels = extractMaterialLabels(company);
  renderDetailLabels(
    detailLabels.length ? detailLabels : [company.material || "Material por definir"]
  );
  if (detailGoto) {
    if (company.id) {
      detailGoto.href = `Compras/empresa.html?id=${company.id}`;
      detailGoto.classList.remove("is-disabled");
      detailGoto.removeAttribute("aria-disabled");
    } else {
      detailGoto.href = "#";
      detailGoto.classList.add("is-disabled");
      detailGoto.setAttribute("aria-disabled", "true");
    }
  }
  detailOverlay.classList.add("is-open");
  detailOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

if (detailClose) {
  detailClose.addEventListener("click", closeCompanyDetail);
}

if (detailOverlay) {
  detailOverlay.addEventListener("click", (event) => {
    if (event.target === detailOverlay) {
      closeCompanyDetail();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCompanyDetail();
  }
});

const detectDeviceMode = () => {
  const coarseQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(hover: none) and (pointer: coarse)")
      : null;
  if (coarseQuery?.matches || window.innerWidth <= 720) {
    return "touch";
  }
  return "desktop";
};

const applyDeviceModeClass = (mode) => {
  const body = document.body;
  if (!body) {
    return;
  }
  body.classList.toggle("is-touch-device", mode === "touch");
};

const syncDeviceMode = () => {
  const detected = detectDeviceMode();
  applyDeviceModeClass(detected);
};

const initDeviceModePersistence = () => {
  syncDeviceMode();

  const handleChange = () => {
    syncDeviceMode();
  };

  window.addEventListener("resize", handleChange);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      syncDeviceMode();
    }
  });

  if (typeof window.matchMedia === "function") {
    const coarseMatcher = window.matchMedia("(hover: none) and (pointer: coarse)");
    if (coarseMatcher.addEventListener) {
      coarseMatcher.addEventListener("change", handleChange);
    } else if (coarseMatcher.addListener) {
      coarseMatcher.addListener(handleChange);
    }
  }
};

initDeviceModePersistence();

const mockCompanies = [
  {
    name: "VerdeCircular S.A.",
    location: "Zona Centro",
    material: "Polietileno reutilizable",
    availability: "2 toneladas",
    priceRange: "$180 - $320",
    state: "Tabasco",
    type: "Reciclaje",
    mode: "Venta",
    photo: "Logo.png",
    labels: ["Papel", "Carton"],
    position: { lat: 17.989456, lng: -92.947506 },
  },
  {
    name: "EcoMetal Norte",
    location: "Parque Industrial",
    material: "Aluminio y acero",
    availability: "5 toneladas",
    priceRange: "$520 - $740",
    state: "Tabasco",
    type: "Metalurgia",
    mode: "Ambos",
    photo: "Logo.png",
    labels: ["Carbon", "Metal"],
    position: { lat: 18.00251, lng: -92.90803 },
  },
  {
    name: "BioReuso Maya",
    location: "Zona Sur",
    material: "Organico compostable",
    availability: "3 toneladas",
    priceRange: "$90 - $150",
    state: "Tabasco",
    type: "Organico",
    mode: "Donacion",
    photo: "Logo.png",
    labels: ["Madera", "Organico"],
    position: { lat: 17.96292, lng: -92.93952 },
  },
  {
    name: "ReTech Circular",
    location: "Zona Este",
    material: "Componentes y pallets",
    availability: "1.5 toneladas",
    priceRange: "$260 - $410",
    state: "Tabasco",
    type: "Industrial",
    mode: "Venta",
    photo: "Logo.png",
    labels: ["Plastico", "Vidrio"],
    position: { lat: 17.98418, lng: -92.9058 },
  },
];

const parsePriceRange = (text) => {
  const matches = text.replace(/[^0-9.]/g, " ").trim().split(/\s+/);
  const numbers = matches.map((value) => parseFloat(value)).filter((n) => !Number.isNaN(n));
  if (numbers.length === 0) {
    return { min: null, max: null };
  }
  if (numbers.length === 1) {
    return { min: numbers[0], max: numbers[0] };
  }
  return { min: numbers[0], max: numbers[1] };
};

const normalizeNumber = (value) => {
  const parsed = parseFloat(String(value).replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
};

const applyFilters = () => {
  const query = searchInput.value.trim().toLowerCase();
  const userMin = normalizeNumber(minInput.value);
  const userMax = normalizeNumber(maxInput.value);

  const hasPriceFilter = userMin !== null || userMax !== null;

  cards.forEach((card) => {
    const priceText =
      card.dataset.priceRange ??
      card.querySelector(".company-price")?.textContent ??
      "";
    const cardRange = parsePriceRange(priceText);
    const content = card.textContent?.toLowerCase() ?? "";

    const matchesQuery = !query || content.includes(query);
    const hasPriceData = cardRange.min !== null && cardRange.max !== null;
    const matchesMin = userMin === null || (hasPriceData && cardRange.max >= userMin);
    const matchesMax = userMax === null || (hasPriceData && cardRange.min <= userMax);
    const matchesPrice = !hasPriceFilter || hasPriceData;

    const visible = matchesQuery && matchesPrice && matchesMin && matchesMax;
    card.classList.toggle("is-hidden", !visible);
  });
};

if (filterButton) {
  filterButton.addEventListener("click", applyFilters);
}

[searchInput, minInput, maxInput].forEach((input) => {
  if (!input) {
    return;
  }
  input.addEventListener("input", applyFilters);
});

const normalizeCompany = (raw) => {
  const min = raw.precio_min ?? raw.price_min ?? raw.min ?? null;
  const max = raw.precio_max ?? raw.price_max ?? raw.max ?? null;
  const priceRange =
    min !== null || max !== null
      ? `$${min ?? "-"} - $${max ?? "-"}`
      : raw.priceRange || "Precio no disponible";

  return {
    id: raw.id_empresa ?? raw.id ?? null,
    name: raw.nombre_empresa ?? raw.name ?? "Empresa",
    location: raw.municipio ?? raw.location ?? "",
    material: raw.tipo_material ?? raw.material ?? "",
    availability: raw.availability ?? "",
    priceRange,
    state: raw.estado ?? raw.state ?? "",
    type: raw.tipo_empresa ?? raw.type ?? "",
    mode: raw.modalidad ?? raw.mode ?? "",
    photo: raw.foto_url ?? raw.photo_url ?? raw.photo ?? "",
    labels: Array.isArray(raw.etiquetas || raw.labels)
      ? raw.etiquetas || raw.labels
      : String(raw.etiquetas || raw.labels || raw.tipo_material || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
    position: {
      lat: Number(raw.lat ?? raw.latitude ?? NaN),
      lng: Number(raw.lng ?? raw.longitude ?? NaN),
    },
  };
};

const parseAvailability = (value) => {
  if (!value) {
    return null;
  }
  const match = String(value).match(/\d+/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
};

const extractMaterialLabels = (company = {}) => {
  const sources = [];
  if (company.material) {
    sources.push(company.material);
  }
  if (Array.isArray(company.labels) && company.labels.length) {
    sources.push(...company.labels);
  }
  if (!sources.length) {
    return [];
  }
  const combined = sources.join(", ");
  const sanitized = combined.replace(/\b(y|and|con)\b/gi, ",");
  const tokens = sanitized
    .split(/[,/·;+&]/)
    .map((token) => token.replace(/\b(material|categoria)\b/gi, "").trim())
    .filter(Boolean);
  const unique = [];
  const seen = new Set();
  tokens.forEach((token) => {
    const key = token.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(token);
  });
  return unique;
};

const renderCompanies = (data) => {
  if (!listElement || !template) {
    return;
  }

  listElement.innerHTML = "";

  if (!data.length) {
    const empty = document.createElement("div");
    empty.className = "company-empty";
    empty.textContent = "No hay empresas disponibles por ahora.";
    listElement.appendChild(empty);
    cards = [];
    return;
  }

  data.forEach((company, index) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".company-card");
    const photo = fragment.querySelector(".company-photo-img");
    const modeTags = fragment.querySelector(".mode-tags");
    const viewMoreLink = fragment.querySelector(".view-more");

    card.dataset.companyIndex = String(index);
    photo.src = company.photo || "Logo.png";
    photo.alt = company.name;
    fragment.querySelector(".company-name").textContent = company.name;
    card.dataset.priceRange = company.priceRange;
    fragment.querySelector(".company-location").textContent =
      `Ubicacion: ${company.location || "Por definir"}`;
    fragment.querySelector(".company-material").textContent =
      `Material: ${company.material || "Por definir"}`;
    fragment.querySelector(".company-state").textContent =
      `Estado: ${company.state || "Por definir"}`;
    modeTags.innerHTML = "";
    const modeValue = String(company.mode || "").toLowerCase();
    const modeSet = new Set();
    if (modeValue.includes("ambos")) {
      modeSet.add("venta");
      modeSet.add("donacion");
    } else {
      const sanitizedModes = modeValue.replace(/\b(y|and|con)\b/gi, ",");
      sanitizedModes
        .split(/[,/·;+&]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => {
          if (item.includes("don")) {
            modeSet.add("donacion");
          } else if (item.includes("vent")) {
            modeSet.add("venta");
          }
        });
    }

    if (!modeSet.size) {
      modeSet.add("unknown");
    }

    const pillConfig = {
      venta: { text: "Venta", className: "mode-pill-sale" },
      donacion: { text: "Donación", className: "mode-pill-donation" },
      unknown: { text: "Sin categoría", className: "mode-pill-unknown" },
    };

    modeSet.forEach((modeKey) => {
      const config = pillConfig[modeKey] ?? pillConfig.unknown;
      const tag = document.createElement("span");
      tag.className = `mode-pill ${config.className}`;
      tag.textContent = config.text;
      modeTags.appendChild(tag);
    });

    if (viewMoreLink) {
      viewMoreLink.href = "#";
      viewMoreLink.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openCompanyDetail(company);
      });
    }

    listElement.appendChild(fragment);
  });

  cards = Array.from(listElement.querySelectorAll(".company-card"));
};

const matchCategory = (company) => {
  const materialKeywords = extractMaterialLabels(company).join(" ");
  const material = `${company.material || ""} ${materialKeywords}`.toLowerCase();
  if (material.includes("carton") || material.includes("cart n")) {
    return "Carton";
  }
  if (material.includes("plast")) {
    return "Plastico";
  }
  if (material.includes("metal") || material.includes("aluminio") || material.includes("acero")) {
    return "Metal";
  }
  if (material.includes("organ")) {
    return "Organico";
  }
  if (material.includes("vidrio")) {
    return "Vidrio";
  }
  if (material.includes("madera")) {
    return "Madera";
  }
  return null;
};

const renderRecommendations = (data) => {
  if (!recommendationsList) {
    return;
  }

  const items = data
    .map((company) => ({
      company,
      category: matchCategory(company),
    }))
    .filter((item) => item.category)
    .slice(0, 6);

  recommendationsList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "rec-empty";
    empty.textContent = "No hay recomendaciones disponibles por ahora.";
    recommendationsList.appendChild(empty);
    return;
  }

  items.forEach(({ company, category }) => {
    const card = document.createElement("div");
    card.className = "rec-card";

    const header = document.createElement("div");
    header.className = "rec-header";
    const thumb = document.createElement("img");
    thumb.className = "rec-thumb";
    thumb.src = company.photo || "Logo.png";
    thumb.alt = company.name;
    const headerText = document.createElement("div");
    const productLine = document.createElement("p");
    productLine.className = "rec-product";
    productLine.textContent = company.material || "Material disponible";
    const companyLineTitle = document.createElement("p");
    companyLineTitle.className = "rec-company";
    companyLineTitle.textContent = company.name;
    headerText.appendChild(productLine);
    headerText.appendChild(companyLineTitle);
    header.appendChild(thumb);
    header.appendChild(headerText);

    const title = document.createElement("div");
    title.className = "rec-title";
    title.textContent = "Recomendado para tu zona";

    const meta = document.createElement("div");
    meta.className = "rec-meta";
    const locationLine = document.createElement("span");
    locationLine.textContent = `Ubicacion: ${company.location || "Por definir"}`;
    const priceLine = document.createElement("span");
    priceLine.textContent = `Precio: ${company.priceRange}`;
    meta.appendChild(locationLine);
    meta.appendChild(priceLine);

    const footer = document.createElement("div");
    footer.className = "rec-footer";
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = category;
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-ghost rec-add";
    addBtn.textContent = "Agregar";
    addBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      addToCart(company);
    });
    const link = document.createElement("a");
    link.className = "btn btn-secondary";
    link.textContent = "Ver empresa";
    link.href = `Compras/empresa.html?id=${company.id ?? ""}`;
    footer.appendChild(tag);
    footer.appendChild(addBtn);
    footer.appendChild(link);

    card.appendChild(header);
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(footer);
    recommendationsList.appendChild(card);
  });
};

const loadUser = () => {
  const stored = localStorage.getItem("ecoris_user");
  if (!stored) {
    if (publishLink) {
      publishLink.style.display = "none";
    }
    return;
  }
  try {
    const data = JSON.parse(stored);
    if (userChip) {
      userChip.classList.add("is-visible");
    }
    if (profileLink) {
      profileLink.classList.add("is-visible");
      profileLink.href =
        data.tipo === "empresa"
          ? "Empresas/perfilempresa.html"
          : "Usuarios/perfilcliente.html";
    }
    if (publishLink) {
      const token = localStorage.getItem("ecoris_token");
      const canPublish = data.tipo === "empresa" && Boolean(token);
      publishLink.style.display = canPublish ? "inline-flex" : "none";
    }
    if (logoutButton) {
      logoutButton.classList.add("is-visible");
    }
    if (userName) {
      userName.textContent = data.nombre || "Usuario";
    }
    if (userRole) {
      userRole.textContent = data.tipo === "empresa" ? "Empresa" : "Cliente";
    }
    if (userAvatar) {
      userAvatar.src = data.foto_url || "Logo.png";
    }
    document.querySelectorAll(".auth-only").forEach((el) => {
      el.style.display = "none";
    });
  } catch (error) {
    localStorage.removeItem("ecoris_user");
  }
};

const loadCart = () => {
  try {
    cart = JSON.parse(localStorage.getItem("ecoris_cart") || "[]");
  } catch (error) {
    cart = [];
  }
};

const saveCart = () => {
  localStorage.setItem("ecoris_cart", JSON.stringify(cart));
};

const updateCartUI = () => {
  if (cartBadge) {
    cartBadge.textContent = String(cart.length);
  }
  if (cartItems) {
    cartItems.innerHTML = "";
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      const title = document.createElement("div");
      title.className = "cart-item-title";
      title.textContent = item.name;
      const sub = document.createElement("div");
      sub.className = "cart-item-sub";
      sub.textContent = item.material || "Material sin definir";
      const controls = document.createElement("div");
      controls.className = "cart-controls";

      const minusBtn = document.createElement("button");
      minusBtn.type = "button";
      minusBtn.className = "cart-qty-btn";
      minusBtn.textContent = "-";
      minusBtn.disabled = item.qty <= 1;
      minusBtn.addEventListener("click", () => changeQuantity(item.id, -1));

      const qtyText = document.createElement("span");
      qtyText.className = "cart-qty";
      qtyText.textContent = String(item.qty);

      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "cart-qty-btn";
      plusBtn.textContent = "+";
      const maxQty = item.maxQty ?? null;
      plusBtn.disabled = maxQty !== null && item.qty >= maxQty;
      plusBtn.addEventListener("click", () => changeQuantity(item.id, 1));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "cart-remove";
      removeBtn.textContent = "Quitar";
      removeBtn.addEventListener("click", () => removeFromCart(item.id));

      controls.appendChild(minusBtn);
      controls.appendChild(qtyText);
      controls.appendChild(plusBtn);
      controls.appendChild(removeBtn);
      row.appendChild(title);
      row.appendChild(sub);
      row.appendChild(controls);
      cartItems.appendChild(row);
    });
  }
  if (cartEmpty) {
    cartEmpty.style.display = cart.length ? "none" : "block";
  }
};

const addToCart = (company) => {
  const existing = cart.find((item) => item.id === company.id);
  const maxQty = parseAvailability(company.availability);
  if (existing) {
    const nextQty = existing.qty + 1;
    existing.qty = maxQty ? Math.min(nextQty, maxQty) : nextQty;
  } else {
    cart.push({
      id: company.id,
      name: company.name,
      material: company.material,
      qty: 1,
      maxQty,
    });
  }
  saveCart();
  updateCartUI();
  if (cartButton) {
    cartButton.classList.remove("is-bounce");
    void cartButton.offsetWidth;
    cartButton.classList.add("is-bounce");
  }
  if (cartPanel) {
    cartPanel.classList.add("is-open");
  }
};

if (detailContact) {
  detailContact.addEventListener("click", () => {
    if (!detailCompany) {
      return;
    }
    addToCart(detailCompany);
    closeCompanyDetail();
  });
}

const changeQuantity = (id, delta) => {
  const item = cart.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  const maxQty = item.maxQty ?? null;
  const next = item.qty + delta;
  if (next < 1) {
    return;
  }
  if (maxQty !== null && next > maxQty) {
    return;
  }
  item.qty = next;
  saveCart();
  updateCartUI();
};

const removeFromCart = (id) => {
  cart = cart.filter((item) => item.id !== id);
  saveCart();
  updateCartUI();
};

const updateMapMarkers = () => {
  if (!mapInstance) {
    return;
  }

  mapMarkers.forEach((marker) => marker.remove());
  mapMarkers = [];

  companies.forEach((company) => {
    const { lat, lng } = company.position;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      mapMarkers.push(null);
      return;
    }

    const etiquetas = extractMaterialLabels(company);
    const etiquetaTexto = etiquetas.length
      ? etiquetas.join(" · ")
      : company.material || "Sin etiquetas";
    const fotoEmpresa = company.photo || "Logo.png";

    const marker = L.marker([lat, lng])
      .addTo(mapInstance)
      .bindPopup(
        `
          <div style="font-family: 'Space Grotesk', Arial, sans-serif; padding: 4px 2px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <img src="${fotoEmpresa}" alt="${company.name}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid #e5e0d6;background:#f5f3ee;" />
              <strong>${company.name}</strong>
            </div>
            <span>${etiquetaTexto}</span>
          </div>
        `
      );

    mapMarkers.push(marker);
  });
};

const bindCardEvents = () => {
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      cards.forEach((item) => item.classList.remove("is-active"));
      card.classList.add("is-active");

      const index = Number(card.dataset.companyIndex);
      const company = companies[index];
      const marker = mapMarkers[index];

      if (!company || !marker || !mapInstance) {
        return;
      }

      mapInstance.flyTo([company.position.lat, company.position.lng], 18, {
        animate: true,
        duration: 1.2,
      });
      marker.openPopup();
    });
  });
};

const loadCompanies = async () => {
  try {
    const response = await fetch("/api/empresas");
    if (!response.ok) {
      throw new Error("No se pudo cargar el API");
    }
    const data = await response.json();
    companies = data.map(normalizeCompany);
  } catch (error) {
    console.error("Error cargando empresas:", error);
    companies = [];
  }

  renderCompanies(companies);
  updateMapMarkers();
  bindCardEvents();
  renderRecommendations(companies);
  applyFilters();
};

const initLeafletMap = () => {
  const mapElement = document.getElementById("map");
  if (!mapElement || !window.L) {
    return;
  }

  const center = [17.989456, -92.947506];
  const streetLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 6,
      attribution: "&copy; OpenStreetMap",
    }
  );
  const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 6,
      attribution: "Tiles &copy; Esri",
    }
  );
  const satelliteLabels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 6,
      attribution: "Labels &copy; Esri",
    }
  );
  const satelliteGroup = L.layerGroup([satelliteLayer, satelliteLabels]);

  mapInstance = L.map(mapElement, {
    zoomControl: true,
    preferCanvas: true,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 120,
    inertiaDeceleration: 2200,
    inertiaMaxSpeed: 1500,
    layers: [satelliteGroup],
  }).setView(center, 12);

  L.control
    .layers({ Calles: streetLayer, Satelite: satelliteGroup }, null, {
      position: "bottomright",
    })
    .addTo(mapInstance);
};

document.addEventListener("DOMContentLoaded", () => {
  initLeafletMap();
  loadCompanies();
  loadUser();
  loadCart();
  updateCartUI();
  if (publishLink) {
    publishLink.addEventListener("click", (event) => {
      const token = localStorage.getItem("ecoris_token");
      const stored = localStorage.getItem("ecoris_user");
      if (!token || !stored) {
        event.preventDefault();
        window.location.href = "Sesiones/iniciosesion.html";
      }
    });
  }
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await fetch("/api/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("Fallo al cerrar sesion", error);
      } finally {
        localStorage.removeItem("ecoris_token");
        localStorage.removeItem("ecoris_user");
        window.location.href = "Sesiones/iniciosesion.html";
      }
    });
  }
  if (cartButton && cartPanel) {
    cartButton.addEventListener("click", () => {
      cartPanel.classList.toggle("is-open");
    });
  }
  if (cartClose && cartPanel) {
    cartClose.addEventListener("click", () => {
      cartPanel.classList.remove("is-open");
    });
  }
  if (cartCheckout) {
    cartCheckout.addEventListener("click", async () => {
      if (!cart.length) {
        alert("Agrega productos antes de solicitar un pedido.");
        return;
      }

      const token = localStorage.getItem("ecoris_token");
      const stored = localStorage.getItem("ecoris_user");
      if (!token || !stored) {
        window.location.href = "Sesiones/iniciosesion.html";
        return;
      }

      let user;
      try {
        user = JSON.parse(stored);
      } catch (error) {
        window.location.href = "Sesiones/iniciosesion.html";
        return;
      }

      if (user.tipo !== "cliente") {
        alert("Solo las cuentas de cliente pueden enviar solicitudes.");
        return;
      }

      const items = cart
        .map((item) => {
          const empresaId = Number(item.id);
          if (!Number.isFinite(empresaId)) {
            return null;
          }
          return {
            empresa_id: empresaId,
            material: item.material,
            cantidad: item.qty,
          };
        })
        .filter(Boolean);

      if (!items.length) {
        alert("No se encontraron empresas validas para el pedido.");
        return;
      }

      try {
        const response = await fetch("/api/notificaciones", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ items }),
        });

        if (!response.ok) {
          throw new Error("Solicitud rechazada");
        }

        cart = [];
        saveCart();
        updateCartUI();
        alert("Tu pedido fue enviado. Revisa tus notificaciones para las respuestas.");
      } catch (error) {
        alert("No se pudo enviar el pedido. Intenta de nuevo en unos minutos.");
      }
    });
  }
  if (cartView && cartPanel) {
    cartView.addEventListener("click", () => {
      window.location.href = "Usuarios/carrito.html";
    });
  }
});
