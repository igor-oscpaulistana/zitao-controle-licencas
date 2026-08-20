
const CONFIG = window.APP_CONFIG || {};
const DEMO_STORAGE_KEY = "zitao-licenses-demo-v2";
const DEMO_LOGIN_KEY = "zitao-login-demo";

let supabaseClient = null;
let backendMode = "demo";
let licenses = [];
let filters = { company: "all", type: "all" };
let currentPage = "dashboard";
let currentEditingId = null;
let currentMode = "details";

const el = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  logoutBtn: document.getElementById("logoutBtn"),
  navtabs: [...document.querySelectorAll(".navtab")],
  dashboardPage: document.getElementById("dashboardPage"),
  licensesPage: document.getElementById("licensesPage"),
  companyFilter: document.getElementById("companyFilter"),
  typeFilter: document.getElementById("typeFilter"),
  resetFilters: document.getElementById("resetFilters"),
  kpiActive: document.getElementById("kpiActive"),
  kpiDue: document.getElementById("kpiDue"),
  kpiExpired: document.getElementById("kpiExpired"),
  kpiCritical: document.getElementById("kpiCritical"),
  criticalCount: document.getElementById("criticalCount"),
  criticalList: document.getElementById("criticalList"),
  typeDistribution: document.getElementById("typeDistribution"),
  licensesTableBody: document.getElementById("licensesTableBody"),
  addLicenseBtn: document.getElementById("addLicenseBtn"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalSubtitle: document.getElementById("modalSubtitle"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  detailsSection: document.getElementById("detailsSection"),
  editSection: document.getElementById("editSection"),
  toast: document.getElementById("toast"),
  asOfText: document.getElementById("asOfText"),
  modeBanner: document.getElementById("modeBanner")
};

function slugify(text) {
  return (text || "arquivo")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}


function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo PDF."));
    reader.readAsDataURL(file);
  });
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.toast.classList.add("hidden"), 3000);
}

function showLoginError(message) {
  el.loginError.textContent = message;
  el.loginError.classList.remove("hidden");
}

function clearLoginError() {
  el.loginError.textContent = "";
  el.loginError.classList.add("hidden");
}

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function normalizeDateInput(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  return value;
}

function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function diffDays(dateString) {
  if (!dateString) return null;
  const due = new Date(`${dateString}T00:00:00`);
  const today = getToday();
  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getSituation(record) {
  if (record.is_inactive || record.status === "Inativa") {
    return { key: "inactive", label: "Inativa", badgeClass: "inactive" };
  }
  if (!record.due_date) {
    return { key: "none", label: "Sem vencimento", badgeClass: "none" };
  }
  const days = diffDays(record.due_date);
  if (days < 0) {
    return { key: "expired", label: "Vencida", badgeClass: "expired" };
  }
  if (days <= 30) {
    return { key: "due", label: "A vencer", badgeClass: "due" };
  }
  return { key: "active", label: "Ativa", badgeClass: "active" };
}

function getStatusBadgeClass(status) {
  if (status === "Em processo de renovação") return "renewal";
  if (status === "Inativa") return "inactive";
  return "active";
}

function toDemoStorage(records) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(records));
}

function readDemoStorage() {
  const saved = localStorage.getItem(DEMO_STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  const seeded = (window.DEMO_LICENSES || []).map((item) => ({ ...item }));
  toDemoStorage(seeded);
  return seeded;
}

async function initBackend() {
  const hasSupabase = CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase;
  if (hasSupabase && !CONFIG.DEMO_MODE) {
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    backendMode = "supabase";
    el.modeBanner.textContent = "Modo online ativado: dados centralizados no Supabase e acessíveis em qualquer computador.";
    el.modeBanner.classList.remove("hidden");
    return;
  }
  backendMode = "demo";
  el.modeBanner.innerHTML = "Modo demonstração local ativo. Para sincronizar os dados em qualquer computador, configure o <strong>Supabase</strong> no arquivo <code>assets/js/config.js</code> e publique a pasta no GitHub Pages, Netlify ou Vercel.";
  el.modeBanner.classList.remove("hidden");
}

async function ensureSession() {
  await initBackend();
  if (backendMode === "supabase") {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      openApp();
      await loadLicenses();
      return;
    }
  } else {
    if (sessionStorage.getItem(DEMO_LOGIN_KEY) === "true") {
      openApp();
      await loadLicenses();
      return;
    }
  }
  openLogin();
}

function openLogin() {
  el.loginView.classList.remove("hidden");
  el.appView.classList.add("hidden");
}

function openApp() {
  el.loginView.classList.add("hidden");
  el.appView.classList.remove("hidden");
}

async function doLogin(username, password) {
  clearLoginError();
  if (username !== (CONFIG.DEFAULT_LOGIN_USERNAME || "nicolly")) {
    throw new Error("Usuário inválido.");
  }
  if (backendMode === "supabase") {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: CONFIG.DEFAULT_LOGIN_EMAIL || `${username}@zitao.local`,
      password
    });
    if (error) throw error;
  } else {
    if (password !== "123456") throw new Error("Senha inválida.");
    sessionStorage.setItem(DEMO_LOGIN_KEY, "true");
  }
}

async function doLogout() {
  if (backendMode === "supabase") {
    await supabaseClient.auth.signOut();
  } else {
    sessionStorage.removeItem(DEMO_LOGIN_KEY);
  }
  openLogin();
}

async function loadLicenses() {
  if (backendMode === "supabase") {
    const { data, error } = await supabaseClient
      .from("licenses")
      .select("*")
      .order("company_name", { ascending: true })
      .order("license_type", { ascending: true });
    if (error) {
      showToast(`Erro ao carregar dados: ${error.message}`);
      licenses = [];
    } else {
      licenses = (data || []).map(normalizeLicense);
    }
  } else {
    licenses = readDemoStorage().map(normalizeLicense);
  }
  renderAll();
}

function normalizeLicense(item) {
  return {
    id: item.id,
    company_name: item.company_name || "",
    company_cnpj: item.company_cnpj || "",
    company_contact: item.company_contact || "",
    license_type: item.license_type || "",
    due_date: normalizeDateInput(item.due_date),
    status: item.status || "Ativa",
    observations: item.observations || "",
    requested_by: item.requested_by || "",
    request_date: normalizeDateInput(item.request_date),
    protocol_date: normalizeDateInput(item.protocol_date),
    completion_date: normalizeDateInput(item.completion_date),
    attachment_name: item.attachment_name || "",
    attachment_url: item.attachment_url || "",
    attachment_path: item.attachment_path || "",
    is_inactive: Boolean(item.is_inactive || item.status === "Inativa")
  };
}

function getFilteredLicenses() {
  return licenses.filter((item) => {
    const companyOk = filters.company === "all" || item.company_name === filters.company;
    const typeOk = filters.type === "all" || item.license_type === filters.type;
    return companyOk && typeOk;
  });
}

function renderFilters() {
  const filtered = getFilteredLicenses();
  const companies = [...new Set(licenses.map((x) => x.company_name).filter(Boolean))].sort();
  const types = [...new Set(licenses.map((x) => x.license_type).filter(Boolean))].sort();

  el.companyFilter.innerHTML = `<option value="all">Todas as empresas</option>` + companies.map((c) => `<option value="${escapeHtml(c)}" ${filters.company === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
  el.typeFilter.innerHTML = `<option value="all">Todos os tipos</option>` + types.map((t) => `<option value="${escapeHtml(t)}" ${filters.type === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("");

  if (!filtered.length) {
    el.asOfText.textContent = "Nenhum registro encontrado para os filtros aplicados.";
    return;
  }
  el.asOfText.textContent = `Última atualização visual: ${new Date().toLocaleDateString("pt-BR")} • ${filtered.length} registro(s) encontrado(s).`;
}

function renderKPIs() {
  const data = getFilteredLicenses();
  let active = 0;
  let due = 0;
  let expired = 0;
  data.forEach((item) => {
    const s = getSituation(item);
    if (s.key === "active") active += 1;
    if (s.key === "due") due += 1;
    if (s.key === "expired") expired += 1;
  });
  el.kpiActive.textContent = active;
  el.kpiDue.textContent = due;
  el.kpiExpired.textContent = expired;
  el.kpiCritical.textContent = due + expired;
}

function renderCriticalList() {
  const data = getFilteredLicenses()
    .filter((item) => {
      const key = getSituation(item).key;
      return key === "due" || key === "expired";
    })
    .sort((a, b) => {
      const da = a.due_date || "9999-12-31";
      const db = b.due_date || "9999-12-31";
      return da.localeCompare(db);
    });

  el.criticalCount.textContent = `${data.length} licença(s)`;
  if (!data.length) {
    el.criticalList.innerHTML = `<div class="empty-state">Nenhuma licença vencida ou a vencer nos próximos 30 dias para os filtros selecionados.</div>`;
    return;
  }
  const header = `
    <div class="critical-row header">
      <div>Empresa / Licença</div>
      <div>Vencimento</div>
      <div>Status</div>
      <div>Situação</div>
    </div>`;
  const rows = data.map((item) => {
    const situation = getSituation(item);
    return `
      <div class="critical-row">
        <div>
          <div class="company-name">${escapeHtml(item.company_name)}</div>
          <div class="cell-muted">${escapeHtml(item.license_type)} • ${escapeHtml(item.company_cnpj || "Sem CNPJ")}</div>
        </div>
        <div class="cell-muted">${formatDate(item.due_date)}</div>
        <div><span class="badge ${getStatusBadgeClass(item.status)}">${escapeHtml(item.status)}</span></div>
        <div><span class="badge ${situation.badgeClass}">${situation.label}</span></div>
      </div>`;
  }).join("");
  el.criticalList.innerHTML = header + rows;
}

function renderTypeDistribution() {
  const data = getFilteredLicenses();
  const grouped = {};
  data.forEach((item) => {
    grouped[item.license_type] = (grouped[item.license_type] || 0) + 1;
  });
  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    el.typeDistribution.innerHTML = `<div class="empty-state">Nenhum dado disponível.</div>`;
    return;
  }
  const max = Math.max(...entries.map(([, value]) => value));
  el.typeDistribution.innerHTML = entries.map(([key, value]) => `
    <div class="type-bar">
      <div class="type-bar-head"><strong>${escapeHtml(key)}</strong><span>${value}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%"></div></div>
    </div>`).join("");
}

function renderTable() {
  const data = getFilteredLicenses().sort((a, b) => a.company_name.localeCompare(b.company_name));
  if (!data.length) {
    el.licensesTableBody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Nenhum registro encontrado.</div></td></tr>`;
    return;
  }
  el.licensesTableBody.innerHTML = data.map((item) => {
    const situation = getSituation(item);
    return `
      <tr class="${item.is_inactive ? "inactive-row" : ""}">
        <td>${escapeHtml(item.company_name)}</td>
        <td>${escapeHtml(item.company_cnpj || "-")}</td>
        <td>${escapeHtml(item.license_type)}</td>
        <td>${formatDate(item.due_date)}</td>
        <td><span class="badge ${getStatusBadgeClass(item.status)}">${escapeHtml(item.status)}</span></td>
        <td><span class="badge ${situation.badgeClass}">${situation.label}</span></td>
        <td>${escapeHtml(item.company_contact || item.requested_by || "-")}</td>
        <td>${item.attachment_url ? `<a class="file-link" target="_blank" rel="noopener" href="${item.attachment_url}">📎 PDF</a>` : "-"}</td>
        <td><button type="button" class="open-btn" data-open-license="${item.id}">Abrir</button></td>
      </tr>`;
  }).join("");
}

function renderAll() {
  renderFilters();
  renderKPIs();
  renderCriticalList();
  renderTypeDistribution();
  renderTable();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setPage(page) {
  currentPage = page;
  el.dashboardPage.classList.toggle("hidden", page !== "dashboard");
  el.licensesPage.classList.toggle("hidden", page !== "licenses");
  el.navtabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.page === page));
}

function openModal() {
  el.modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  el.modalBackdrop.classList.add("hidden");
  el.detailsSection.innerHTML = "";
  el.editSection.innerHTML = "";
  currentEditingId = null;
}

function findLicense(id) {
  return licenses.find((item) => item.id === id);
}

function buildDetailGrid(item) {
  const situation = getSituation(item);
  return `
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-label">Empresa</div>
        <div class="detail-value">${escapeHtml(item.company_name)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">CNPJ</div>
        <div class="detail-value">${escapeHtml(item.company_cnpj || "Não informado")}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Tipo de licença</div>
        <div class="detail-value">${escapeHtml(item.license_type)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Vencimento</div>
        <div class="detail-value">${formatDate(item.due_date)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Status</div>
        <div class="detail-value"><span class="badge ${getStatusBadgeClass(item.status)}">${escapeHtml(item.status)}</span></div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Situação</div>
        <div class="detail-value"><span class="badge ${situation.badgeClass}">${situation.label}</span></div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Responsável / Contato</div>
        <div class="detail-value">${escapeHtml(item.company_contact || item.requested_by || "Não informado")}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Protocolado por</div>
        <div class="detail-value">${escapeHtml(item.requested_by || "Não informado")}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Data solicitação</div>
        <div class="detail-value">${formatDate(item.request_date)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Data protocolo</div>
        <div class="detail-value">${formatDate(item.protocol_date)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Data finalização</div>
        <div class="detail-value">${formatDate(item.completion_date)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Anexo PDF</div>
        <div class="detail-value">${item.attachment_url ? `<a class="file-link" href="${item.attachment_url}" target="_blank" rel="noopener">📎 ${escapeHtml(item.attachment_name || "Abrir anexo")}</a>` : "Sem anexo"}</div>
      </div>
      <div class="detail-item full">
        <div class="detail-label">Observações</div>
        <div class="detail-value">${escapeHtml(item.observations || "Sem observações")}</div>
      </div>
    </div>
    <div class="modal-actions">
      <button type="button" class="secondary-btn" data-action="edit-license" data-license-id="${item.id}">Alterar</button>
      <button type="button" class="danger-btn" data-action="delete-license" data-license-id="${item.id}">Excluir</button>
      <button type="button" class="ghost-btn" data-action="inactivate-license" data-license-id="${item.id}">Inativar</button>
    </div>`;
}

function openLicenseDetails(id) {
  const item = findLicense(id);
  if (!item) return;
  currentEditingId = id;
  currentMode = "details";
  el.modalTitle.textContent = "Detalhes da licença";
  el.modalSubtitle.textContent = "Consulte os dados e utilize as ações abaixo para manter o cadastro atualizado.";
  el.detailsSection.innerHTML = buildDetailGrid(item);
  el.editSection.classList.add("hidden");
  el.editSection.innerHTML = "";
  openModal();
}

function renderForm(item = null) {
  const isNew = !item;
  const record = item || {
    company_name: "",
    company_cnpj: "",
    company_contact: "",
    license_type: "",
    due_date: "",
    status: "Ativa",
    observations: "",
    requested_by: "",
    request_date: "",
    protocol_date: "",
    completion_date: "",
    attachment_name: "",
    attachment_url: ""
  };
  el.modalTitle.textContent = isNew ? "Nova licença" : "Alterar licença";
  el.modalSubtitle.textContent = isNew ? "Inclua um novo registro de licença no sistema." : "Atualize vencimento, status, observações e anexo da licença.";
  el.detailsSection.innerHTML = isNew ? "" : buildDetailGrid(item);
  el.editSection.classList.remove("hidden");
  el.editSection.innerHTML = `
    <form id="licenseForm" class="edit-form">
      <div class="field">
        <label>Empresa</label>
        <input name="company_name" value="${escapeHtml(record.company_name)}" required />
      </div>
      <div class="field">
        <label>CNPJ</label>
        <input name="company_cnpj" value="${escapeHtml(record.company_cnpj)}" />
      </div>
      <div class="field">
        <label>Tipo de licença</label>
        <input name="license_type" value="${escapeHtml(record.license_type)}" required />
      </div>
      <div class="field">
        <label>Vencimento</label>
        <input name="due_date" type="date" value="${record.due_date || ""}" />
      </div>
      <div class="field">
        <label>Status</label>
        <select name="status">
          ${["Ativa", "Em processo de renovação", "Inativa"].map((status) => `<option value="${status}" ${record.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Responsável / Contato</label>
        <input name="company_contact" value="${escapeHtml(record.company_contact)}" />
      </div>
      <div class="field">
        <label>Protocolado por</label>
        <input name="requested_by" value="${escapeHtml(record.requested_by)}" />
      </div>
      <div class="field">
        <label>Data da solicitação</label>
        <input name="request_date" type="date" value="${record.request_date || ""}" />
      </div>
      <div class="field">
        <label>Data do protocolo</label>
        <input name="protocol_date" type="date" value="${record.protocol_date || ""}" />
      </div>
      <div class="field">
        <label>Data de finalização</label>
        <input name="completion_date" type="date" value="${record.completion_date || ""}" />
      </div>
      <div class="field full">
        <label>Observações</label>
        <textarea name="observations" placeholder="Digite observações relevantes">${escapeHtml(record.observations)}</textarea>
      </div>
      <div class="field full">
        <label>Anexar PDF da licença</label>
        <input name="attachment" type="file" accept="application/pdf" />
        <div class="file-note">${record.attachment_url ? `Anexo atual: <a class="file-link" target="_blank" rel="noopener" href="${record.attachment_url}">${escapeHtml(record.attachment_name || "Abrir PDF")}</a>` : "Nenhum PDF anexado."}</div>
      </div>
      <div class="modal-actions full">
        <button type="submit" class="primary-btn">${isNew ? "Salvar licença" : "Salvar alterações"}</button>
        <button type="button" id="cancelEditBtn" class="secondary-btn">Cancelar</button>
      </div>
    </form>`;

  const form = document.getElementById("licenseForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleSaveForm(form, item ? item.id : null);
  });
  document.getElementById("cancelEditBtn").addEventListener("click", () => {
    if (item) {
      openLicenseDetails(item.id);
    } else {
      closeModal();
    }
  });
  openModal();
}

async function uploadAttachment(file, baseRecord) {
  if (!file) return { attachment_name: baseRecord.attachment_name || "", attachment_url: baseRecord.attachment_url || "", attachment_path: baseRecord.attachment_path || "" };
  if (file.type !== "application/pdf") {
    throw new Error("O anexo deve ser um arquivo PDF.");
  }

  if (backendMode === "supabase") {
    const safePath = `${slugify(baseRecord.company_name || "empresa")}/${Date.now()}-${slugify(file.name)}.pdf`;
    const { error: uploadError } = await supabaseClient.storage.from(CONFIG.STORAGE_BUCKET || "licencas-pdf").upload(safePath, file, { upsert: true, contentType: "application/pdf" });
    if (uploadError) throw uploadError;
    const { data } = supabaseClient.storage.from(CONFIG.STORAGE_BUCKET || "licencas-pdf").getPublicUrl(safePath);
    return { attachment_name: file.name, attachment_url: data.publicUrl, attachment_path: safePath };
  }

  const dataUrl = await readFileAsDataUrl(file);
  return {
    attachment_name: file.name,
    attachment_url: dataUrl,
    attachment_path: file.name
  };
}

async function handleSaveForm(form, id = null) {
  const formData = new FormData(form);
  const current = id ? findLicense(id) : {};
  const payload = {
    company_name: formData.get("company_name")?.toString().trim(),
    company_cnpj: formData.get("company_cnpj")?.toString().trim(),
    company_contact: formData.get("company_contact")?.toString().trim(),
    license_type: formData.get("license_type")?.toString().trim(),
    due_date: normalizeDateInput(formData.get("due_date")?.toString().trim()),
    status: formData.get("status")?.toString(),
    observations: formData.get("observations")?.toString().trim(),
    requested_by: formData.get("requested_by")?.toString().trim(),
    request_date: normalizeDateInput(formData.get("request_date")?.toString().trim()),
    protocol_date: normalizeDateInput(formData.get("protocol_date")?.toString().trim()),
    completion_date: normalizeDateInput(formData.get("completion_date")?.toString().trim()),
    is_inactive: formData.get("status")?.toString() === "Inativa"
  };

  const file = formData.get("attachment");
  const attachment = await uploadAttachment(file && file.size ? file : null, current);
  Object.assign(payload, attachment);

  if (!payload.company_name || !payload.license_type) {
    showToast("Preencha empresa e tipo de licença.");
    return;
  }

  if (backendMode === "supabase") {
    if (id) {
      const { error } = await supabaseClient.from("licenses").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from("licenses").insert(payload);
      if (error) throw error;
    }
  } else {
    const demoRecords = readDemoStorage();
    if (id) {
      const idx = demoRecords.findIndex((item) => item.id === id);
      demoRecords[idx] = { ...demoRecords[idx], ...payload };
    } else {
      demoRecords.push({ ...payload, id: `demo-${Date.now()}` });
    }
    toDemoStorage(demoRecords);
  }

  await loadLicenses();
  closeModal();
  showToast(id ? "Licença atualizada com sucesso." : "Licença incluída com sucesso.");
}

async function deleteLicense(id) {
  if (!confirm("Deseja realmente excluir esta licença?")) return;
  if (backendMode === "supabase") {
    const { error } = await supabaseClient.from("licenses").delete().eq("id", id);
    if (error) throw error;
  } else {
    const demoRecords = readDemoStorage().filter((item) => item.id !== id);
    toDemoStorage(demoRecords);
  }
  await loadLicenses();
  closeModal();
  showToast("Licença excluída com sucesso.");
}

async function inactivateLicense(id) {
  if (!confirm("Deseja inativar esta licença?")) return;
  const payload = { status: "Inativa", is_inactive: true };
  if (backendMode === "supabase") {
    const { error } = await supabaseClient.from("licenses").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const demoRecords = readDemoStorage();
    const idx = demoRecords.findIndex((item) => item.id === id);
    demoRecords[idx] = { ...demoRecords[idx], ...payload };
    toDemoStorage(demoRecords);
  }
  await loadLicenses();
  openLicenseDetails(id);
  showToast("Licença inativada.");
}

el.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await doLogin(el.username.value.trim(), el.password.value);
    el.password.value = "";
    openApp();
    await loadLicenses();
    showToast("Login realizado com sucesso.");
  } catch (error) {
    showLoginError(error.message || "Não foi possível realizar o login.");
  }
});

el.logoutBtn.addEventListener("click", async () => {
  await doLogout();
});

el.navtabs.forEach((tab) => tab.addEventListener("click", () => setPage(tab.dataset.page)));

el.companyFilter.addEventListener("change", () => {
  filters.company = el.companyFilter.value;
  renderAll();
});

el.typeFilter.addEventListener("change", () => {
  filters.type = el.typeFilter.value;
  renderAll();
});

el.resetFilters.addEventListener("click", () => {
  filters = { company: "all", type: "all" };
  renderAll();
});

el.addLicenseBtn.addEventListener("click", () => renderForm(null));
el.closeModalBtn.addEventListener("click", closeModal);
el.modalBackdrop.addEventListener("click", (event) => {
  if (event.target === el.modalBackdrop) closeModal();
});

document.addEventListener("click", async (event) => {
  const openBtn = event.target.closest("[data-open-license]");
  if (openBtn) {
    openLicenseDetails(openBtn.dataset.openLicense);
    return;
  }

  const actionBtn = event.target.closest("[data-action]");
  if (!actionBtn) return;
  const action = actionBtn.dataset.action;
  const id = actionBtn.dataset.licenseId;
  const item = findLicense(id);
  if (!item) return;

  try {
    if (action === "edit-license") renderForm(item);
    if (action === "delete-license") await deleteLicense(id);
    if (action === "inactivate-license") await inactivateLicense(id);
  } catch (error) {
    showToast(error.message || "Ocorreu um erro ao processar a ação.");
  }
});

ensureSession();
