/**
 * 新濠建設客服平台 – 前端主程式
 */

const App = (() => {
  /* ── 狀態 ── */
  let state = {
    user: null,     // { name, idCard, projectCode, projectName, unit, unitType }
    screen: "login",
  };

  /* ════════════════════════════════════════
     初始化
  ════════════════════════════════════════ */
  function init() {
    // 嘗試恢復 session
    const saved = sessionStorage.getItem(CONFIG.SESSION_KEY);
    if (saved) {
      try {
        state.user = JSON.parse(saved);
        enterApp();
        return;
      } catch (_) {
        sessionStorage.removeItem(CONFIG.SESSION_KEY);
      }
    }

    // 載入建案清單
    loadProjects();
  }

  async function loadProjects() {
    try {
      const data = await callGAS({ action: "getProjects" });
      const select = document.getElementById("select-project");
      select.innerHTML = '<option value="">── 請選擇建案 ──</option>';
      (data.projects || []).forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.code;
        opt.textContent = p.name;
        select.appendChild(opt);
      });
    } catch (e) {
      showToast("無法載入建案清單，請重新整理頁面", "error");
    }
  }

  /* ════════════════════════════════════════
     登入 / 登出
  ════════════════════════════════════════ */
  async function login(event) {
    event.preventDefault();
    const projectCode = document.getElementById("select-project").value;
    const idCard = document.getElementById("input-id").value.trim().toUpperCase();

    if (!projectCode) { showToast("請先選擇建案", "error"); return; }
    if (!idCard)       { showToast("請輸入身分證字號", "error"); return; }
    if (!validateIdCard(idCard)) {
      showToast("身分證字號格式不正確，請確認後再試", "error");
      return;
    }

    showLoading(true);
    try {
      const data = await callGAS({ action: "login", projectCode, idCard });
      if (data.success) {
        state.user = data.user;
        sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(data.user));
        enterApp();
      } else {
        showToast(data.message || "查無此客戶資料，請確認資訊是否正確", "error");
      }
    } catch (e) {
      showToast("連線失敗，請稍後再試", "error");
    } finally {
      showLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
    state.user = null;
    document.getElementById("navbar").classList.add("hidden");
    goTo("login");
    document.getElementById("input-id").value = "";
    loadProjects();
  }

  function enterApp() {
    const u = state.user;
    document.getElementById("nav-user-info").textContent =
      `${u.projectName}｜${u.unit}｜${u.name}`;
    document.getElementById("navbar").classList.remove("hidden");

    document.getElementById("dashboard-welcome").textContent = `歡迎您，${u.name}`;
    document.getElementById("dashboard-info").textContent =
      `${u.projectName} ${u.unit}（${u.unitType}）`;

    goTo("dashboard");
  }

  /* ════════════════════════════════════════
     頁面導覽
  ════════════════════════════════════════ */
  function goTo(screen) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(`screen-${screen}`);
    if (target) target.classList.add("active");

    if (screen === "login") {
      document.getElementById("navbar").classList.add("hidden");
    }

    if (screen === "drawings") {
      loadDownloads();
      loadUploadHistory();
    }

    state.screen = screen;
    window.scrollTo(0, 0);
  }

  /* ════════════════════════════════════════
     客變圖資 – 下載
  ════════════════════════════════════════ */
  async function loadDownloads() {
    const container = document.getElementById("download-list");
    container.innerHTML = '<p class="text-muted text-center">載入中…</p>';

    try {
      const data = await callGAS({
        action: "getFiles",
        folderId: state.user.folderId,
      });

      const files = data.files || [];
      if (!files.length) {
        container.innerHTML = '<p class="text-muted text-center">目前尚無可下載的圖資，請聯絡客服</p>';
        return;
      }

      container.innerHTML = "";
      files.forEach(f => {
        container.appendChild(buildFileItem(f));
      });
    } catch (e) {
      container.innerHTML = '<p class="text-muted text-center">載入失敗，請稍後再試</p>';
    }
  }

  function buildFileItem(f) {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const iconClass = ext === "pdf" ? "pdf" : (ext === "dwg" || ext === "dxf") ? "cad" : "other";
    const iconLabel = ext.toUpperCase() || "FILE";

    const div = document.createElement("div");
    div.className = "file-item";
    div.innerHTML = `
      <div class="file-icon ${iconClass}">${iconLabel}</div>
      <span class="file-name">${f.name}</span>
      ${f.size ? `<span class="file-size">${formatSize(f.size)}</span>` : ""}
      <a href="${f.downloadUrl}" target="_blank" rel="noopener" class="btn-download">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        下載
      </a>`;
    return div;
  }

  /* ════════════════════════════════════════
     客變圖資 – 上傳
  ════════════════════════════════════════ */
  function onDragOver(e) {
    e.preventDefault();
    document.getElementById("drop-zone").classList.add("drag-over");
  }
  function onDragLeave() {
    document.getElementById("drop-zone").classList.remove("drag-over");
  }
  function onDrop(e) {
    e.preventDefault();
    document.getElementById("drop-zone").classList.remove("drag-over");
    handleFiles(Array.from(e.dataTransfer.files));
  }
  function onFileSelect(e) {
    handleFiles(Array.from(e.target.files));
    e.target.value = "";
  }

  function handleFiles(files) {
    files.forEach(file => {
      if (file.size > CONFIG.MAX_FILE_SIZE) {
        showToast(`${file.name} 超過 20 MB 限制，略過`, "error");
        return;
      }
      uploadFile(file);
    });
  }

  function uploadFile(file) {
    const queue = document.getElementById("upload-queue");

    // 建立上傳項目 UI
    const itemId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item = document.createElement("div");
    item.className = "upload-item";
    item.id = itemId;
    item.innerHTML = `
      <div class="upload-item-top">
        <span class="upload-item-name">${escapeHtml(file.name)}</span>
        <span class="upload-item-status status-uploading">上傳中</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>`;
    queue.prepend(item);

    const statusEl   = item.querySelector(".upload-item-status");
    const progressEl = item.querySelector(".progress-fill");

    // 讀檔並轉 base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      progressEl.style.width = "30%";
      const base64 = e.target.result.split(",")[1];

      try {
        progressEl.style.width = "60%";
        const data = await callGAS({
          action: "uploadFile",
          idCard:      state.user.idCard,
          projectCode: state.user.projectCode,
          unit:        state.user.unit,
          folderId:    state.user.folderId,
          fileName:    file.name,
          mimeType:    file.type || "application/octet-stream",
          base64,
        });

        progressEl.style.width = "100%";
        if (data.success) {
          statusEl.textContent = "完成";
          statusEl.className   = "upload-item-status status-done";
          showToast(`${file.name} 上傳成功`, "success");
          // 延遲移除並重整歷史
          setTimeout(() => {
            item.remove();
            loadUploadHistory();
          }, 3000);
        } else {
          throw new Error(data.message || "上傳失敗");
        }
      } catch (err) {
        statusEl.textContent = "失敗";
        statusEl.className   = "upload-item-status status-error";
        showToast(`${file.name} 上傳失敗：${err.message}`, "error");
      }
    };
    reader.onerror = () => {
      statusEl.textContent = "讀取失敗";
      statusEl.className   = "upload-item-status status-error";
    };
    reader.readAsDataURL(file);
  }

  async function loadUploadHistory() {
    const container = document.getElementById("upload-history");
    container.innerHTML = '<p class="text-muted text-center">載入中…</p>';

    try {
      const data = await callGAS({
        action: "getUploadHistory",
        idCard: state.user.idCard,
        projectCode: state.user.projectCode,
      });
      const records = data.records || [];
      if (!records.length) {
        container.innerHTML = '<p class="text-muted text-center">尚無上傳紀錄</p>';
        return;
      }
      container.innerHTML = "";
      records.slice(0, 20).forEach(r => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span class="history-item-name">${escapeHtml(r.fileName)}</span>
          <span class="history-date">${r.date}</span>`;
        container.appendChild(div);
      });
    } catch (_) {
      container.innerHTML = '<p class="text-muted text-center">無法載入紀錄</p>';
    }
  }

  /* ════════════════════════════════════════
     API 呼叫
  ════════════════════════════════════════ */
  async function callGAS(payload) {
    const isGet = ["getProjects", "getDrawings", "getUploadHistory"].includes(payload.action);

    let url = CONFIG.GAS_URL;
    let options = {};

    if (isGet) {
      const params = new URLSearchParams(payload);
      url = `${CONFIG.GAS_URL}?${params.toString()}`;
      options = { method: "GET" };
    } else {
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };
    }

    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /* ════════════════════════════════════════
     UI 工具
  ════════════════════════════════════════ */
  function showLoading(show) {
    document.getElementById("loading-overlay").classList.toggle("hidden", !show);
  }

  let toastTimer;
  function showToast(msg, type = "info") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = `toast ${type}`;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3500);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function validateIdCard(id) {
    if (!/^[A-Z][12]\d{8}$/.test(id)) return false;
    const letters = "ABCDEFGHJKLMNPQRSTUVXYWZIO";
    const v = letters.indexOf(id[0]) + 10;
    const digits = [Math.floor(v / 10), v % 10, ...id.slice(1).split("").map(Number)];
    const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
    const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
    return sum % 10 === 0;
  }

  /* 對外暴露 */
  return { init, login, logout, goTo, onDragOver, onDragLeave, onDrop, onFileSelect };
})();

document.addEventListener("DOMContentLoaded", App.init);
