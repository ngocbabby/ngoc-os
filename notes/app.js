"use strict";
const KEY="ngoc_os_notes_v1",OLD="ngoc_os_v3";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const fresh=()=>({version:1,notes:[],folders:[]});
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||"null");return x&&Array.isArray(x.notes)&&Array.isArray(x.folders)?x:fresh()}catch{return fresh()}}
let db=load(),route="home",prior="home",current=null,filter=null,search="",saveTimer=null;
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const id=()=>String(Date.now())+"-"+Math.random().toString(36).slice(2,9);
function persist(){try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch{notify("Không đủ bộ nhớ. Hãy sao chép nội dung trước khi rời trang.");return false}}
function notify(s){const t=$("#toast");t.textContent=s;t.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove("show"),2300)}
function dateText(ms){return new Date(ms).toLocaleDateString("vi-VN",{day:"numeric",month:"long"})}
function all(){return [...db.notes].filter(n=>!n.archived).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updated-a.updated)}
function title(n){return n.title?.trim()||"Không có tiêu đề"}
function excerpt(n){return n.kind==="checklist"?(n.items||[]).map(x=>(x.checked?"☑ ":"☐ ")+x.text).join("\n"):n.text||""}
function filled(n){return Boolean(n.title?.trim()||n.text?.trim()||(n.items||[]).some(x=>x.text?.trim())||n.image)}
function get(id){return db.notes.find(x=>x.id===id)}
function icon(type){return '<svg><use href="#i-'+type+'"/></svg>'}
function card(n,compact=false){return '<button type="button" class="'+(compact?"recent-card":"note-tile")+'" data-open="'+esc(n.id)+'">'+(compact?'<div class="recent-thumb">'+(n.image?'<img alt="" src="'+esc(n.image)+'">':icon(n.kind==="checklist"?"i-list":"note").replace("#i-i-","#i-"))+'</div><div class="recent-info"><b>'+esc(title(n))+'</b><p>'+esc(excerpt(n).slice(0,70))+'</p></div>':(n.image?'<img class="tile-photo" src="'+esc(n.image)+'" alt="">':"")+'<h3>'+esc(title(n))+(n.pinned?" 📌":"")+'</h3>'+(n.kind==="checklist"?(n.items||[]).slice(0,5).map(x=>'<div class="tile-check">'+(x.checked?"☑":"☐")+' '+esc(x.text)+'</div>').join(""):'<p>'+esc(excerpt(n))+'</p>')+'<small>'+dateText(n.updated)+'</small>')+'</button>'}
function draw(){const notes=all();
 $("#recentNotes").innerHTML=notes.length?notes.slice(0,8).map(n=>card(n,true)).join(""):'<div class="empty-message">Chưa có ghi chú nào.</div>';
 $("#homeNoteRows").innerHTML=notes.slice(0,5).map(n=>'<button class="home-note-row" data-open="'+esc(n.id)+'"><span class="row-chevron">'+icon("arrow")+'</span><span class="row-icon">'+icon(n.kind==="checklist"?"task":"note")+'</span><span class="row-name">'+esc(title(n))+'</span><span class="row-more">'+icon("more")+'</span></button>').join("");
 $("#viewMoreBtn").hidden=notes.length<=5;
 const subset=notes.filter(n=>(!filter||n.folder===filter)&&(!search||(title(n)+" "+excerpt(n)).toLocaleLowerCase().includes(search.toLocaleLowerCase())));
 $("#notesGrid").innerHTML=subset.length?subset.filter(n=>n.kind!=="checklist").map(n=>card(n)).join("")||'<div class="empty-message">Chưa có ghi chú dạng văn bản.</div>':'<div class="empty-message">Chưa có ghi chú nào.</div>';
 $("#taskGrid").innerHTML=notes.filter(n=>n.kind==="checklist"&&(!search||(title(n)+" "+excerpt(n)).toLowerCase().includes(search.toLowerCase()))).map(n=>card(n)).join("")||'<div class="empty-message">Chưa có danh sách nào.</div>';
 $("#noteCount").textContent=subset.length+" ghi chú";
 $("#folderFilterBtn").firstChild.textContent=filter?(db.folders.find(x=>x.id===filter)?.name||"Tất cả")+" ":"Tất cả ghi chú ";
 $("#folderList").innerHTML=db.folders.map(f=>'<button class="folder-row" data-folder="'+esc(f.id)+'">'+icon("folder")+'<span>'+esc(f.name)+'</span><small>'+notes.filter(n=>n.folder===f.id).length+'</small>'+icon("arrow")+'</button>').join("")||'<div class="empty-message">Chưa có thư mục.</div>';
 $$("[data-open]").forEach(b=>b.onclick=()=>openNote(b.dataset.open));
 $$("[data-folder]").forEach(b=>b.onclick=()=>{filter=b.dataset.folder;show("notes")});
}
function show(page){if(route==="editor")flush();route=page;$$(".screen").forEach(x=>x.classList.toggle("active",x.id==="screen-"+page));$$("[data-route]").forEach(x=>x.classList.toggle("active",x.dataset.route===page));$("#topbar").hidden=page==="editor";$("#homeDock").hidden=page!=="home";$("#listDock").hidden=page!=="notes"&&page!=="tasks";$("#fab").hidden=page==="editor";closeFab();window.scrollTo(0,0);draw()}
function make(kind="text"){closeFab();current={id:id(),kind,title:"",text:"",items:kind==="checklist"?[{id:id(),text:"",checked:false}]:[],folder:filter,pinned:false,archived:false,created:Date.now(),updated:Date.now(),image:null};prior=route;route="editor";renderEditor();showEditor()}
function openNote(key){const n=get(key);if(!n)return;current=structuredClone(n);prior=route;route="editor";renderEditor();showEditor()}
function showEditor(){$$(".screen").forEach(x=>x.classList.toggle("active",x.id==="screen-editor"));$("#topbar").hidden=true;$("#homeDock").hidden=true;$("#listDock").hidden=true;$("#fab").hidden=true;closeFab();window.scrollTo(0,0)}
function renderEditor(){const n=current;if(!n)return;$("#editorTitle").value=n.title||"";$("#editorBody").value=n.text||"";$("#textEditor").hidden=n.kind==="checklist";$("#checklistEditor").hidden=n.kind!=="checklist";$("#editorPin").classList.toggle("on",Boolean(n.pinned));$("#folderBreadcrumb").textContent=db.folders.find(x=>x.id===n.folder)?.name||"Riêng tư";$("#editorMedia").innerHTML=n.image?'<img src="'+esc(n.image)+'" alt="Ảnh đã đính kèm">':"";$("#saveStatus").textContent="Tự động lưu trên thiết bị";renderItems()}
function renderItems(){if(!current||current.kind!=="checklist")return;$("#checklistItems").innerHTML=(current.items||[]).map(x=>'<div class="checklist-row"><input type="checkbox" data-box="'+esc(x.id)+'" aria-label="Hoàn thành mục" '+(x.checked?"checked":"")+'><input type="text" data-item="'+esc(x.id)+'" enterkeyhint="next" placeholder="Việc cần làm" value="'+esc(x.text)+'"><button class="remove-row" data-remove="'+esc(x.id)+'" type="button" aria-label="Xóa mục">'+icon("x")+'</button></div>').join("");
 document.querySelectorAll("[data-item]").forEach(el=>{
  el.oninput=()=>{const x=current.items.find(i=>i.id===el.dataset.item);if(x)x.text=el.value;queueSave()};
  el.onkeydown=e=>{
    if(e.key!=="Enter"||e.isComposing)return;
    e.preventDefault();
    const index=current.items.findIndex(item=>item.id===el.dataset.item);
    if(!el.value.trim()){
      // Empty row: move to an existing next row instead of creating endless blank items.
      const next=current.items[index+1];
      if(next)Array.from(document.querySelectorAll("[data-item]")).find(input=>input.dataset.item===next.id)?.focus();
      return;
    }
    insertListItem(el.dataset.item);
  };
 });
 $$("[data-box]").forEach(el=>el.onchange=()=>{const x=current.items.find(i=>i.id===el.dataset.box);if(x)x.checked=el.checked;queueSave()});
 $$("[data-remove]").forEach(el=>el.onclick=()=>{current.items=current.items.filter(i=>i.id!==el.dataset.remove);queueSave();renderItems()})
}
function insertListItem(afterId=null){
 if(!current||current.kind!=="checklist")return;
 const newItem={id:id(),text:"",checked:false};
 const index=afterId===null?-1:current.items.findIndex(item=>item.id===afterId);
 current.items.splice(index<0?current.items.length:index+1,0,newItem);
 renderItems();
 queueSave();
 const input=Array.from(document.querySelectorAll("[data-item]")).find(el=>el.dataset.item===newItem.id);
 if(input){input.focus();input.scrollIntoView?.({block:"nearest"})}
}
function flush(){clearTimeout(saveTimer);if(!current)return;const old=get(current.id);if(!filled(current)){if(old)db.notes=db.notes.filter(x=>x.id!==current.id);persist();return}current.updated=Date.now();if(old)Object.assign(old,current);else db.notes.unshift(structuredClone(current));if(persist())$("#saveStatus").textContent="Đã lưu"}
function queueSave(){$("#saveStatus").textContent="Đang lưu…";clearTimeout(saveTimer);saveTimer=setTimeout(flush,550)}
function done(){flush();current=null;show(prior)}
function overlay(title,html,init){$("#overlayHeading").textContent=title;$("#overlayBody").innerHTML=html;$("#overlay").hidden=false;if(init)init()}
function closeOverlay(){$("#overlay").hidden=true}
function newFolder(){overlay("Thư mục mới",'<form id="folderForm"><input id="folderName" maxlength="80" placeholder="Tên thư mục" required autocomplete="off"><button class="overlay-btn overlay-primary" type="submit">Tạo thư mục</button></form>',()=>{$("#folderForm").onsubmit=e=>{e.preventDefault();const name=$("#folderName").value.trim();if(!name)return;db.folders.push({id:id(),name});persist();closeOverlay();draw()}})}
function folderMenu(){overlay("Thư mục",'<button class="overlay-btn" data-folder-option="">Tất cả ghi chú</button>'+db.folders.map(f=>'<button class="overlay-btn" data-folder-option="'+esc(f.id)+'">'+esc(f.name)+'</button>').join("")+'<button class="overlay-btn" id="newFolderHere">＋ Thư mục mới</button>',()=>{$$("[data-folder-option]").forEach(b=>b.onclick=()=>{filter=b.dataset.folderOption||null;closeOverlay();show("notes")});$("#newFolderHere").onclick=newFolder})}
function query(){overlay("Tìm kiếm",'<input id="searchField" placeholder="Tìm trong ghi chú…" value="'+esc(search)+'"><button id="searchGo" class="overlay-btn overlay-primary">Tìm kiếm</button>',()=>{$("#searchGo").onclick=()=>{search=$("#searchField").value.trim();closeOverlay();show("notes")};$("#searchField").onkeydown=e=>{if(e.key==="Enter")$("#searchGo").click()};$("#searchField").focus()})}
function settings(){overlay("Tuỳ chọn",'<p class="overlay-description">Ghi chú chỉ lưu trên trình duyệt này, không tự đồng bộ giữa các điện thoại. Hãy xuất bản sao trước khi xoá dữ liệu trình duyệt.</p><button id="exportNotes" class="overlay-btn">↓ Xuất bản sao JSON</button><button id="importNotesBtn" class="overlay-btn">↑ Khôi phục JSON</button><input id="importNotes" hidden type="file" accept=".json,application/json"><p class="overlay-description">Bản sao có thể chứa thông tin riêng tư. Không chia sẻ công khai.</p>',()=>{$("#exportNotes").onclick=()=>{flush();const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ngoc-os-notes-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$("#importNotesBtn").onclick=()=>$("#importNotes").click();$("#importNotes").onchange=async e=>{const file=e.target.files?.[0];if(!file||file.size>3e6){notify("Tệp không hợp lệ hoặc quá lớn");return}try{const data=JSON.parse(await file.text());if(!Array.isArray(data.notes)||!Array.isArray(data.folders))throw Error();if(!confirm("Thay thế toàn bộ ghi chú hiện có bằng dữ liệu trong bản sao?"))return;db={version:1,notes:data.notes.filter(x=>x&&typeof x.id==="string"&&["text","checklist"].includes(x.kind)).map(x=>({...x,image:typeof x.image==="string"&&x.image.startsWith("data:image/")?x.image:null})),folders:data.folders.filter(x=>x&&typeof x.id==="string"&&typeof x.name==="string")};persist();closeOverlay();show("home");notify("Đã khôi phục")}catch{notify("Không đọc được bản sao")}}})}
function moreEditor(){if(!current)return;overlay("Tuỳ chọn ghi chú",'<button id="changeFolder" class="overlay-btn">📁 Chuyển thư mục</button><button id="deleteNote" class="overlay-btn">🗑️ Xóa ghi chú</button>',()=>{$("#changeFolder").onclick=()=>{overlay("Chọn thư mục",'<button class="overlay-btn" data-move="">Riêng tư</button>'+db.folders.map(f=>'<button class="overlay-btn" data-move="'+esc(f.id)+'">'+esc(f.name)+'</button>').join(""),()=>{$$("[data-move]").forEach(b=>b.onclick=()=>{current.folder=b.dataset.move||null;queueSave();renderEditor();closeOverlay()})})};$("#deleteNote").onclick=()=>{if(!confirm("Xóa ghi chú này?"))return;db.notes=db.notes.filter(x=>x.id!==current.id);current=null;persist();closeOverlay();show(prior);notify("Đã xóa ghi chú")}})}
function addPhoto(){if(!current)make("text");$("#imageFile").click()}
function create(type){closeFab();if(type==="image"){make("text");addPhoto();return}if(type==="audio"){make("text");notify("Ghi âm sẽ được bổ sung ở phiên bản sau");return}if(type==="draw"){make("text");notify("Bản vẽ sẽ được bổ sung ở phiên bản sau");return}make(type==="checklist"?"checklist":"text")}
function closeFab(){$("#fab").classList.remove("open");$("#fab").setAttribute("aria-expanded","false");$("#fabMenu").hidden=true;$("#fabBackdrop").hidden=true}
function toggleFab(){const open=$("#fabMenu").hidden;$("#fabMenu").hidden=!open;$("#fabBackdrop").hidden=!open;$("#fab").classList.toggle("open",open);$("#fab").setAttribute("aria-expanded",String(open))}
$$("[data-route]").forEach(b=>b.onclick=()=>{if(b.dataset.route==="notes")filter=null;show(b.dataset.route)});
$$("[data-action]").forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==="new-folder")newFolder();else if(a==="manage-folders")show("folders");else if(a==="search")query();else if(a==="choose-folder")folderMenu();else if(a==="settings")settings()});
$("#composeBtn").onclick=()=>make("text");$("#fab").onclick=toggleFab;$("#fabBackdrop").onclick=closeFab;$$("[data-create]").forEach(b=>b.onclick=()=>create(b.dataset.create));
$("#editorBack").onclick=done;$("#editorDone").onclick=done;$("#editorTitle").oninput=e=>{if(current){current.title=e.target.value;queueSave()}};$("#editorBody").oninput=e=>{if(current){current.text=e.target.value;queueSave()}};$("#addListItem").onclick=()=>insertListItem();
$("#editorPin").onclick=()=>{if(!current)return;current.pinned=!current.pinned;renderEditor();queueSave()};$("#editorArchive").onclick=()=>{if(!current)return;current.archived=!current.archived;queueSave();notify(current.archived?"Đã lưu trữ":"Đã bỏ lưu trữ");done()};$("#editorMore").onclick=moreEditor;
$("#editorInsert").onclick=()=>overlay("Chèn nội dung",'<button id="insertChecklist" class="overlay-btn">☑ Danh sách</button><button id="insertImage" class="overlay-btn">▧ Hình ảnh</button>',()=>{$("#insertChecklist").onclick=()=>{if(!current)return;current.kind="checklist";current.items=current.items?.length?current.items:[{id:id(),text:"",checked:false}];renderEditor();queueSave();closeOverlay()};$("#insertImage").onclick=()=>{closeOverlay();addPhoto()}});
$("#editorImage").onclick=addPhoto;$("#editorAudio").onclick=()=>notify("Ghi âm sẽ được bổ sung sau");$("#editorSketch").onclick=()=>notify("Bản vẽ sẽ được bổ sung sau");
$("#imageFile").onchange=async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;if(!f.type.startsWith("image/")||f.size>1e6){notify("Chỉ ảnh dưới 1 MB để tránh đầy bộ nhớ");return}const reader=new FileReader();reader.onload=()=>{if(!current)return;current.image=reader.result;renderEditor();queueSave()};reader.readAsDataURL(f)};
$("#editorShare").onclick=async()=>{if(!current)return;const content=title(current)+"\n\n"+excerpt(current);try{if(navigator.share)await navigator.share({text:content});else{await navigator.clipboard.writeText(content);notify("Đã sao chép nội dung")}}catch{}};
$("#closeOverlay").onclick=closeOverlay;$("#overlay").onclick=e=>{if(e.target.id==="overlay")closeOverlay()};
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeOverlay();closeFab()}});window.addEventListener("beforeunload",()=>{if(route==="editor")flush()});
show("home");
