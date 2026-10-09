"use strict";
(() => {
  const ROOT_KEY = "ngoc_os_v3";
  const NOTES_KEY = "ngoc_os_notes_v1";
  const CYCLE_KEY = "ngoc_os_cycle_guardian_v1";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const empty = () => ({tasks:[], money:[], daily:[], notes:[], hero:0, liked:false});
  const safe = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
  const yen = value => "¥" + Number(value || 0).toLocaleString("ja-JP");

  let db;
  try { db = JSON.parse(localStorage.getItem(ROOT_KEY) || "null") || empty(); }
  catch { db = empty(); }
  for (const key of ["tasks","money","daily","notes"]) if (!Array.isArray(db[key])) db[key] = [];

  const toast = message => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  };
  function save() {
    try { localStorage.setItem(ROOT_KEY, JSON.stringify(db)); }
    catch { toast("Không lưu được. Hãy kiểm tra bộ nhớ trình duyệt."); return false; }
    render();
    return true;
  }
  function render() {
    const tasks = $("#tasksList");
    const money = $("#moneyList");
    const notes = $("#notesList");
    if (tasks) {
      tasks.innerHTML = db.tasks.map(t =>
        '<div class="row"><small>' + safe(t.date || "") + '</small><span style="' + (t.done ? 'text-decoration:line-through;opacity:.6' : '') + '">' +
        safe(t.title) + '</span><button class="check" data-check="' + safe(t.id) +
        '" aria-label="Đánh dấu hoàn thành: ' + safe(t.title) + '" style="background:' + (t.done ? 'var(--pink)' : '#fff') + '"></button></div>'
      ).join("") || '<p style="color:#92838e;font-size:13px;padding:15px">Chưa có công việc nào.</p>';
    }
    if (money) {
      money.innerHTML = db.money.map(x =>
        '<div class="row"><small>' + (x.type === "in" ? "Thu" : "Chi") +
        '</small><span>' + safe(x.title) + '</span><b>' + (x.type === "in" ? "+" : "−") +
        yen(x.amount) + '</b></div>'
      ).join("") || '<p style="color:#92838e;font-size:13px;padding:15px">Chưa có khoản thu chi nào.</p>';
    }
    if (notes) {
      notes.innerHTML = db.notes.map(n =>
        '<div class="row"><small>' + safe(n.time || "") + '</small><span><b>' +
        safe(n.title) + '</b><br>' + safe(n.text) + '</span><span>Ghi chú cũ</span></div>'
      ).join("") || '<p style="color:#92838e;font-size:13px;padding:15px">Không có ghi chú cũ.</p>';
    }
    $$("[data-check]").forEach(btn => {
      btn.onclick = () => {
        const t = db.tasks.find(item => String(item.id) === btn.dataset.check);
        if (!t) return;
        t.done = !t.done;
        save();
      };
    });
  }

  function switchView(view) {
    if (!$("#view-" + view)) return;
    $$(".view").forEach(el => el.classList.toggle("active", el.id === "view-" + view));
    $$("[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === view));
    window.scrollTo({top:0,behavior:"smooth"});
  }
  $$("[data-view]").forEach(el => { el.onclick = () => switchView(el.dataset.view); });

  function tick() {
    const d = new Date(), h = d.getHours();
    const greeting = $("#homeGreeting"), date = $("#homeDate");
    if (greeting) greeting.textContent = (h < 11 ? "Chào buổi sáng" : h < 17 ? "Chào buổi chiều" : "Chào buổi tối") + " ♡";
    if (date) date.textContent = d.toLocaleDateString("vi-VN", {weekday:"short",day:"numeric",month:"numeric"});
  }
  function updateCycle() {
    const title = $("#cycleHomeTitle"), hint = $("#cycleHomeHint");
    if (!title || !hint) return;
    title.textContent = "Chu kỳ của tôi";
    hint.textContent = "Theo dõi chu kỳ kinh nguyệt";
    try {
      const data = JSON.parse(localStorage.getItem(CYCLE_KEY) || "null");
      const entries = (data?.periods || []).filter(p => p.start && /^\d{4}-\d{2}-\d{2}$/.test(p.start))
        .sort((a,b) => a.start.localeCompare(b.start));
      const p = entries.at(-1);
      if (!p) return;
      const now = new Date();
      const start = new Date(p.start + "T12:00:00");
      const delta = Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()) -
        Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000) + 1;
      if (!Number.isFinite(delta) || delta < 1) return;
      title.textContent = p.end ? "Ngày chu kỳ thứ " + delta :
        delta <= 8 ? "Ngày kinh thứ " + delta : "Xác nhận ngày hết kinh";
      hint.textContent = p.end ? "Xem lịch và những ghi nhận của bạn" : "Mở để cập nhật chu kỳ";
    } catch {}
  }

  const modal = $("#modal"), textarea = $("#quickInput"), typeSelect = $("#quickType");
  function openQuick() {
    if (!modal || !textarea) return;
    modal.classList.remove("hidden");
    textarea.focus();
  }
  function closeQuick() { modal?.classList.add("hidden"); }
  for (const id of ["quickBtn","mobileQuick","sideQuick"]) {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = openQuick;
  }
  $("#cancel")?.addEventListener("click",closeQuick);
  modal?.addEventListener("click",e => { if (e.target === modal) closeQuick(); });
  document.addEventListener("keydown",e => { if (e.key === "Escape") closeQuick(); });

  function saveToNotes(text) {
    let notes;
    try { notes = JSON.parse(localStorage.getItem(NOTES_KEY) || "null"); } catch {}
    if (!notes || !Array.isArray(notes.notes) || !Array.isArray(notes.folders))
      notes = {version:1,notes:[],folders:[]};
    const time = Date.now();
    notes.notes.unshift({
      id: String(time) + "-" + Math.random().toString(36).slice(2,8),
      kind:"text", title:text.split("\n")[0].slice(0,100),
      text, items:[], folder:null, pinned:false, archived:false,
      created:time, updated:time, image:null
    });
    try { localStorage.setItem(NOTES_KEY,JSON.stringify(notes)); return true; }
    catch { toast("Chưa lưu được ghi chú; hãy thử lại."); return false; }
  }
  function getAmount(text) {
    const match = text.match(/(\d[\d.,]*)/);
    return match ? Number(match[1].replace(/[.,]/g,"")) : 0;
  }
  $("#saveQuick")?.addEventListener("click", () => {
    const text = textarea.value.trim();
    if (!text) { toast("Hãy nhập nội dung trước."); return; }
    const type = typeSelect?.value || "task";
    if (type === "note") {
      if (!saveToNotes(text)) return;
      textarea.value = "";
      closeQuick();
      location.href = "./notes/";
      return;
    }
    const unique = Date.now() + Math.floor(Math.random()*9999);
    if (type === "task") {
      db.tasks.unshift({id:unique,title:text,date:"Hôm nay",done:false});
    } else if (type === "expense" || type === "income") {
      const amount = getAmount(text);
      if (!amount || !Number.isFinite(amount)) { toast("Hãy ghi số tiền bằng số."); return; }
      db.money.unshift({id:unique,title:text,type:type==="income"?"in":"out",amount});
    }
    if (!save()) return;
    textarea.value = "";
    closeQuick();
    toast("Đã lưu");
    switchView(type==="task"?"tasks":"money");
  });

  tick();
  setInterval(tick,60_000);
  updateCycle();
  window.addEventListener("pageshow",updateCycle);
  window.addEventListener("storage",e => { if (e.key===CYCLE_KEY) updateCycle(); });
  render();
})();
