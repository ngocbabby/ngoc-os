"use strict";
(function moneyApp(){
 const KEY="ngoc_os_money_v1",LEGACY="ngoc_os_v3";
 const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
 const categories={
  food:{name:"Ăn uống",icon:"🍽️"},shopping:{name:"Mua sắm",icon:"🛒"},
  transport:{name:"Đi lại / xăng xe",icon:"🚗"},home:{name:"Nhà ở",icon:"🏠"},
  bills:{name:"Hóa đơn / điện nước",icon:"💡"},health:{name:"Y tế",icon:"💗"},
  study:{name:"Học tập",icon:"📚"},entertainment:{name:"Giải trí",icon:"🎬"},
  salary:{name:"Lương",icon:"💼"},refund:{name:"Hoàn tiền",icon:"🔁"},
  gift:{name:"Quà tặng",icon:"🎁"},other:{name:"Khác",icon:"🧾"}
 };
 const expenseCategories=["food","shopping","transport","home","bills","health","study","entertainment","other"];
 const incomeCategories=["salary","refund","gift","other"];
 const id=()=>Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9);
 const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const label=key=>categories[key]?.name||categories.other.name;
 const symbol=key=>categories[key]?.icon||"🧾";
 const money=(value,currency="JPY")=>new Intl.NumberFormat("ja-JP",{style:"currency",currency:currency==="VND"?"VND":"JPY",maximumFractionDigits:0}).format(Number(value)||0).replace("JP¥","¥").replace("₫","đ");
 const dayKey=(date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
 const timeKey=(date=new Date())=>[String(date.getHours()).padStart(2,"0"),String(date.getMinutes()).padStart(2,"0")].join(":");
 const validDay=day=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(day||""))return false;const [y,m,d]=day.split("-").map(Number);const date=new Date(y,m-1,d,12);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d};
 const blank=()=>({version:1,wallets:[{id:"cash-jpy",name:"Tiền mặt",currency:"JPY",openingBalance:0}],transactions:[],budgets:[],settings:{hideBalance:false,legacyImportDone:false}});
 let db;
 try{
  const existing=JSON.parse(localStorage.getItem(KEY)||"null");
  db=existing&&Array.isArray(existing.wallets)&&Array.isArray(existing.transactions)&&Array.isArray(existing.budgets)?existing:blank();
 }catch{db=blank()}
 if(!db.wallets.length)db.wallets=blank().wallets;
 db.settings ||= {hideBalance:false,legacyImportDone:false};

 let screen="overview",filter="all",monthIndex=new Date().getFullYear()*12+new Date().getMonth(),searchText="";
 let editingTxId=null,entryType="expense",receiptFile=null,receiptObjectUrl=null,detectedReceiptCurrency=null,scanId=0,busyScan=false,editingWalletId=null,editingBudgetId=null;
 const toast=message=>{
  const element=$("#toast");element.textContent=message;element.classList.add("show");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove("show"),3400);
 };
 function store(){try{localStorage.setItem(KEY,JSON.stringify(db));renderAll();return true}catch{toast("Không lưu được. Hãy sao lưu và kiểm tra dung lượng trình duyệt.");return false}}
 function wallet(id){return db.wallets.find(w=>w.id===id)}
 function balance(w){
  let amount=Number(w.openingBalance)||0;
  for(const tx of db.transactions){
   if(tx.type==="income"&&tx.walletId===w.id)amount+=tx.amount;
   if(tx.type==="expense"&&tx.walletId===w.id)amount-=tx.amount;
   if(tx.type==="transfer"){
    if(tx.walletId===w.id)amount-=tx.amount;
    if(tx.toWalletId===w.id)amount+=tx.amount;
   }
  }
  return amount;
 }
 function monthBounds(){
  const year=Math.floor(monthIndex/12),month=monthIndex%12;
  return {year,month,first:dayKey(new Date(year,month,1)),last:dayKey(new Date(year,month+1,0)),label:new Date(year,month,1).toLocaleDateString("vi-VN",{month:"long",year:"numeric"})};
 }
 const todayMonth=()=>new Date().getFullYear()*12+new Date().getMonth();
 function inMonth(tx,idx=monthIndex){
  const y=Math.floor(idx/12),m=idx%12;
  return tx.date?.slice(0,7)===y+"-"+String(m+1).padStart(2,"0");
 }
 const totals=(idx=monthIndex,currency="JPY")=>{
  const transactions=db.transactions.filter(tx=>tx.currency===currency&&inMonth(tx,idx));
  return {
   out:transactions.filter(tx=>tx.type==="expense").reduce((sum,tx)=>sum+tx.amount,0),
   in:transactions.filter(tx=>tx.type==="income").reduce((sum,tx)=>sum+tx.amount,0)
  };
 };
 function icon(name){return '<svg><use href="#i-'+name+'"/></svg>'}
 function sortTransactions(tx){return [...tx].sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.time||"").localeCompare(a.time||"")||(b.created||0)-(a.created||0))}
 function renderWallets(){
  const current=db.wallets.filter(w=>w.currency==="JPY"),jpyBalance=current.reduce((sum,w)=>sum+balance(w),0);
  $("#mainBalance").textContent=db.settings.hideBalance?"••••••":money(jpyBalance,"JPY");
  $("#selectedCurrencyText").textContent="Số dư JPY · ví VND được tính riêng";
  $(".balance-label").firstChild.textContent="Tổng số dư JPY ";
  $("#toggleBalance").innerHTML=icon(db.settings.hideBalance?"eyeoff":"eye");
  $("#overviewWallets").innerHTML=db.wallets.map(w=>
   '<div class="wallet-mini"><span class="wallet-mini-icon">'+icon("wallet")+'</span><span class="wallet-mini-name">'+esc(w.name)+' <small style="font-weight:400;color:#aaa">('+esc(w.currency)+')</small></span><strong class="wallet-mini-amount">'+(db.settings.hideBalance?"•••":money(balance(w),w.currency))+'</strong></div>'
  ).join("")||'<p class="wallet-mini-empty">Chưa có ví nào.</p>';
  $("#accountsWallets").innerHTML=db.wallets.map(w=>
   '<button type="button" data-edit-wallet="'+esc(w.id)+'" class="wallet-label" style="width:100%;background:none;border-left:0;border-right:0;border-top:0;color:inherit;text-align:left;cursor:pointer">'+icon("wallet")+'<strong>'+esc(w.name)+'</strong><small>'+(db.settings.hideBalance?"•••":money(balance(w),w.currency))+'</small>'+icon("chevron")+'</button>'
  ).join("");
  $$("[data-edit-wallet]").forEach(b=>b.onclick=()=>openWallet(b.dataset.editWallet));
 }
 function monthlyTotals(){
  const current=todayMonth(),{year,month}=(()=>({year:Math.floor(current/12),month:current%12}))(),currentTotals=totals(current,"JPY");
  $("#monthExpense").textContent=money(currentTotals.out,"JPY");
  $("#monthIncome").textContent=money(currentTotals.in,"JPY");
  const weeks=[];let peak=0;
  for(let week=0;week<5;week++){
   const start=week*7+1,end=Math.min((week+1)*7,new Date(year,month+1,0).getDate());
   if(start>end)continue;
   const included=db.transactions.filter(tx=>tx.currency==="JPY"&&inMonth(tx,current)&&Number(tx.date.slice(8))>=start&&Number(tx.date.slice(8))<=end);
   const expense=included.filter(tx=>tx.type==="expense").reduce((a,b)=>a+b.amount,0);
   const income=included.filter(tx=>tx.type==="income").reduce((a,b)=>a+b.amount,0);
   peak=Math.max(peak,expense,income);weeks.push({start,expense,income});
  }
  $("#overviewChart").innerHTML=weeks.map(w=>'<div class="chart-slot"><div class="chart-bars"><div class="chart-bar out" style="height:'+(peak?w.expense/peak*100:0)+'%"></div><div class="chart-bar in" style="height:'+(peak?w.income/peak*100:0)+'%"></div></div><span class="chart-day">'+w.start+'/'+(month+1)+'</span></div>').join("");
  $("#chartCaption").textContent="Biểu đồ theo tuần · "+new Date(year,month).toLocaleDateString("vi-VN",{month:"long",year:"numeric"})+" · JPY";
  const spending={};for(const tx of db.transactions)if(tx.type==="expense"&&tx.currency==="JPY"&&inMonth(tx,current))spending[tx.category]=(spending[tx.category]||0)+tx.amount;
  const order=Object.entries(spending).sort((a,b)=>b[1]-a[1]).slice(0,5);
  $("#topCategories").innerHTML=order.length?order.map(([key,amount])=>
   '<div class="category-line"><span class="category-bubble">'+symbol(key)+'</span><div class="category-content"><div class="category-content-top"><b>'+esc(label(key))+'</b><span>'+money(amount,"JPY")+' · '+(currentTotals.out?Math.round(amount/currentTotals.out*100):0)+'%</span></div><div class="progress-track"><span style="width:'+(currentTotals.out?Math.min(100,amount/currentTotals.out*100):0)+'%"></span></div></div></div>'
  ).join(""):'<div class="empty-panel">Chưa có khoản chi trong tháng. Nhấn ＋ để ghi khoản chi đầu tiên.</div>';
 }
 function renderTransactions(){
  const {label:monthLabel}=monthBounds();$("#monthTitle").textContent=monthLabel;
  $$(".type-tab").forEach(b=>b.classList.toggle("active",b.dataset.filter===filter));
  const q=searchText.trim().toLocaleLowerCase();
  const list=sortTransactions(db.transactions.filter(tx=>inMonth(tx)&&(filter==="all"||tx.type===filter)&&(!q||[tx.merchant,label(tx.category),tx.note].some(t=>String(t||"").toLocaleLowerCase().includes(q)))));
  const groups=new Map();
  for(const tx of list){if(!groups.has(tx.date))groups.set(tx.date,[]);groups.get(tx.date).push(tx)}
  if(!list.length){
   $("#transactionList").innerHTML='<div class="no-transactions"><div class="empty-emoji">📭</div><strong>Chưa có giao dịch trong kỳ này</strong><span>Chụp bill hoặc nhập khoản chi thủ công.</span><button type="button" id="startManual">＋ Thêm giao dịch</button></div>';
   $("#startManual").onclick=()=>openEntry("expense");
   return;
  }
  const names={expense:"Chi",income:"Thu",transfer:"Chuyển ví"};
  $("#transactionList").innerHTML=[...groups.entries()].map(([date,items])=>{
   const text=new Date(date+"T12:00:00").toLocaleDateString("vi-VN",{weekday:"short",day:"numeric",month:"numeric",year:"numeric"});
   return '<div class="date-group"><span>'+esc(text)+'</span><strong>'+items.length+' giao dịch</strong></div><div class="tx-group">'+items.map(tx=>
    '<button class="tx-row" data-edit-tx="'+esc(tx.id)+'" type="button"><span class="tx-icon">'+(tx.type==="transfer"?"🔁":tx.type==="income"?"💰":symbol(tx.category))+'</span><span class="tx-info"><strong>'+esc(tx.merchant||names[tx.type]||"Giao dịch")+'</strong><small>'+esc(tx.time||"")+" · "+esc(tx.type==="transfer"?"Chuyển ví":label(tx.category))+' · '+esc(tx.currency)+'</small></span><span class="tx-amount '+esc(tx.type)+'">'+(tx.type==="expense"?"−":tx.type==="income"?"+":"⇄")+money(tx.amount,tx.currency)+'</span></button>'
   ).join("")+'</div>';
  }).join("");
  $$("[data-edit-tx]").forEach(b=>b.onclick=()=>openEntry(null,b.dataset.editTx));
 }
 function renderBudgets(){
  const {label:monthLabel}=monthBounds();$("#budgetMonth").textContent=monthLabel;
  if(!db.budgets.length){
   $("#budgetList").innerHTML='<div class="budget-empty"><div class="budget-illustration">📊</div><h2>Bạn chưa có ngân sách</h2><p>Tạo giới hạn chi tiêu mỗi tháng để theo dõi<br>những khoản quan trọng, bằng JPY hoặc VND.</p><button class="primary-button" id="emptyBudgetBtn" type="button">Tạo ngân sách</button></div>';
   $("#emptyBudgetBtn").onclick=()=>openBudget();return;
  }
  $("#budgetList").innerHTML=db.budgets.map(b=>{
   const spent=db.transactions.filter(tx=>tx.type==="expense"&&tx.currency===b.currency&&tx.category===b.category&&inMonth(tx)).reduce((a,x)=>a+x.amount,0);
   const ratio=Math.min(100,spent/b.amount*100),over=spent>b.amount;
   return '<article class="budget-row"><div class="budget-meta"><strong>'+symbol(b.category)+' '+esc(label(b.category))+'</strong><span>'+money(b.amount,b.currency)+'</span></div><div class="budget-progress '+(over?"over":"")+'"><div style="width:'+ratio+'%"></div></div><div class="budget-foot"><span>Đã chi '+money(spent,b.currency)+'</span><span>'+(over?"Vượt "+money(spent-b.amount,b.currency):"Còn "+money(b.amount-spent,b.currency))+'</span></div><div class="budget-row-actions"><button type="button" class="text-button" data-edit-budget="'+esc(b.id)+'">Sửa</button> <button type="button" class="text-button" data-delete-budget="'+esc(b.id)+'">Xóa</button></div></article>';
  }).join("");
  $$("[data-edit-budget]").forEach(b=>b.onclick=()=>openBudget(b.dataset.editBudget));
  $$("[data-delete-budget]").forEach(b=>b.onclick=()=>{if(confirm("Xóa ngân sách này?")){db.budgets=db.budgets.filter(x=>x.id!==b.dataset.deleteBudget);store()}});
 }
 function renderAll(){renderWallets();monthlyTotals();renderTransactions();renderBudgets()}
 function show(next){if(!$("#screen-"+next))return;screen=next;$$(".screen").forEach(s=>s.classList.toggle("active",s.id==="screen-"+next));$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.screen===next));window.scrollTo({top:0,behavior:"smooth"});renderAll()}
 $$("[data-screen]").forEach(b=>b.onclick=()=>show(b.dataset.screen));
 $("#toggleBalance").onclick=()=>{db.settings.hideBalance=!db.settings.hideBalance;store()};
 $("#monthPrev").onclick=()=>{monthIndex--;renderTransactions();renderBudgets()};
 $("#monthNext").onclick=()=>{monthIndex++;renderTransactions();renderBudgets()};
 $$(".type-tab").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderTransactions()});
 function options(cats,current){return cats.map(key=>'<option value="'+key+'" '+(current===key?"selected":"")+'>'+symbol(key)+" "+esc(label(key))+'</option>').join("")}
 function walletOptions(selected,currency=null){return db.wallets.filter(w=>!currency||w.currency===currency).map(w=>'<option value="'+esc(w.id)+'" '+(selected===w.id?"selected":"")+'>'+esc(w.name)+' ('+esc(w.currency)+')</option>').join("")}
 function overlayOpen(name){$("#"+name).hidden=false;document.body.style.overflow="hidden";}
 function overlayClose(name){$("#"+name).hidden=true;if(!$$(".overlay:not([hidden])").length)document.body.style.overflow="";if(name==="entryOverlay"){scanId++;resetReceipt()}}
 $$("[data-close]").forEach(b=>b.onclick=()=>overlayClose(b.dataset.close));
 $$(".overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o)overlayClose(o.id)}));
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){for(const o of $$(".overlay:not([hidden])"))overlayClose(o.id)}});
 function updateEntryUI(){
  $$(".segment").forEach(b=>b.classList.toggle("active",b.dataset.entryType===entryType));
  $("#scanPanel").hidden=entryType!=="expense";
  $("#toWalletField").hidden=entryType!=="transfer";
  $("#categoryInput").disabled=entryType==="transfer";
  $("#categoryInput").innerHTML=options(entryType==="income"?incomeCategories:expenseCategories,$("#categoryInput").value);
  if(!$("#categoryInput").value)$("#categoryInput").value=entryType==="income"?"salary":"other";
  const selected=$("#walletInput").value;
  $("#walletInput").innerHTML=walletOptions(selected);
  if(!$("#walletInput").value&&db.wallets.length)$("#walletInput").value=db.wallets[0].id;
  const selectedWallet=wallet($("#walletInput").value);
  $("#amountUnit").textContent=selectedWallet?.currency||"JPY";
  const others=db.wallets.filter(w=>w.currency===selectedWallet?.currency&&w.id!==selectedWallet?.id);
  const selectedDestination=$("#toWalletInput").value;
  const otherWallets=db.wallets.filter(w=>w.currency===selectedWallet?.currency&&w.id!==selectedWallet?.id);
  $("#toWalletInput").innerHTML=otherWallets.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.name)+' ('+esc(w.currency)+')</option>').join("");
  if(otherWallets.some(w=>w.id===selectedDestination))$("#toWalletInput").value=selectedDestination;
  if(entryType==="transfer")$("#scanStatus").textContent="Chuyển tiền chỉ hỗ trợ giữa hai ví cùng đơn vị tiền.";
 }
 function resetReceipt(){
  if(receiptObjectUrl){URL.revokeObjectURL(receiptObjectUrl);receiptObjectUrl=null}
  receiptFile=null;detectedReceiptCurrency=null;busyScan=false;$("#receiptPreview").hidden=true;$("#receiptImage").removeAttribute("src");
  $("#rawOcrDetails").hidden=true;$("#rawOcrText").textContent="";$("#reviewWarning").hidden=true;$("#reviewWarning").textContent="⚠️ Kiểm tra lại số tiền và ngày giờ trước khi lưu. OCR có thể nhận nhầm.";$("#retryScan").hidden=true;
  const s=$("#scanStatus");s.textContent="Chọn ảnh hóa đơn; phần mềm sẽ thử điền số tiền, cửa hàng và thời gian.";s.className="scan-status";
 }
 function openEntry(type="expense",editId=null){
  resetReceipt();scanId++;editingTxId=editId;
  const existing=editId?db.transactions.find(t=>t.id===editId):null;
  entryType=existing?.type||type||"expense";
  $("#entryHeading").textContent=editId?"Sửa giao dịch":"Thêm giao dịch";
  $("#deleteTransaction").hidden=!editId;
  $("#amountInput").value=existing?.amount??"";
  $("#merchantInput").value=existing?.merchant||"";
  $("#memoInput").value=existing?.note||"";
  $("#dateInput").value=existing?.date||dayKey();
  $("#timeInput").value=existing?.time||timeKey();
  $("#walletInput").innerHTML=walletOptions(existing?.walletId||db.wallets[0]?.id);
  $("#walletInput").value=existing?.walletId||db.wallets[0]?.id||"";
  $("#categoryInput").innerHTML=options(entryType==="income"?incomeCategories:expenseCategories,existing?.category);
  if(existing?.category)$("#categoryInput").value=existing.category;
  $("#toWalletInput").innerHTML=walletOptions(existing?.toWalletId);
  if(existing?.toWalletId)$("#toWalletInput").value=existing.toWalletId;
  updateEntryUI();overlayOpen("entryOverlay");
 }
 function setEntryType(type){entryType=type;updateEntryUI()}
 $$(".segment").forEach(b=>b.onclick=()=>setEntryType(b.dataset.entryType));
 $("#walletInput").onchange=()=>updateEntryUI();
 $("#navAdd").onclick=()=>openEntry("expense");
 $("#scanShortcut").onclick=()=>{openEntry("expense");$("#cameraBtn").click()};
 $("#cameraBtn").onclick=()=>$("#captureInput").click();
 $("#galleryBtn").onclick=()=>$("#imageInput").click();
 $("#removeReceipt").onclick=()=>{scanId++;resetReceipt()};
 $("#retryScan").onclick=()=>{if(receiptFile)runScan(receiptFile)};
 for(const input of [$("#captureInput"),$("#imageInput")]){
  input.addEventListener("change",()=>{const f=input.files?.[0];input.value="";if(f)runScan(f)});
 }
 function progress(message,value=0){
  const s=$("#scanStatus");s.textContent=message+(value>0?" "+Math.round(value*100)+"%":"");
  s.className="scan-status loading";
 }
 async function runScan(file){
  const request=++scanId;
  if(receiptObjectUrl){URL.revokeObjectURL(receiptObjectUrl);receiptObjectUrl=null}
  if(!file.type.startsWith("image/")||file.size>15_000_000){toast("Chọn ảnh JPG/PNG/WebP dưới 15 MB.");return}
  receiptFile=file;receiptObjectUrl=URL.createObjectURL(file);$("#receiptImage").src=receiptObjectUrl;$("#receiptPreview").hidden=false;
  $("#reviewWarning").hidden=true;$("#rawOcrDetails").hidden=true;$("#retryScan").hidden=true;busyScan=true;
  $("#cameraBtn").disabled=$("#galleryBtn").disabled=true;
  try{
   progress("Đang nhận diện chữ trên bill…");
   const parsed=await window.MoneyReceipt.recognizeReceipt(file,(message,value)=>{if(request===scanId)progress(message,value)});
   if(request!==scanId)return;
   $("#rawOcrDetails").hidden=false;$("#rawOcrText").textContent=parsed.rawText||"(Không nhận diện được chữ)";
   $("#reviewWarning").hidden=false;
   detectedReceiptCurrency=parsed.currency;
   if(parsed.amount)$("#amountInput").value=parsed.amount;
   else $("#amountInput").value="";
   if(parsed.merchant)$("#merchantInput").value=parsed.merchant;
   else $("#merchantInput").value="";
   $("#categoryInput").value=parsed.category||"other";
   if(parsed.date)$("#dateInput").value=parsed.date;else $("#dateInput").value="";
   if(parsed.time)$("#timeInput").value=parsed.time;else $("#timeInput").value="";
   const matching=db.wallets.find(w=>w.currency===parsed.currency);
   if(matching){$("#walletInput").value=matching.id;updateEntryUI()}
   else $("#reviewWarning").textContent="⚠️ Bill dùng "+parsed.currency+" nhưng chưa có ví tương ứng. Hãy tạo và chọn ví "+parsed.currency+" trước khi lưu.";
   const hasFields=Boolean(parsed.amount&&parsed.merchant&&parsed.date);
   const status=$("#scanStatus");status.className="scan-status "+(hasFields?"success":"error");
   status.textContent=parsed.rawText.trim()
    ? "Đã đọc bill · "+(parsed.confidence==="high"?"Có vẻ rõ":"Cần kiểm tra kỹ")+". "+(parsed.missing.length?"Chưa nhận diện: "+parsed.missing.join(", ")+". ":"")+"Bạn có thể sửa mọi trường trước khi lưu."
    : "Ảnh chưa được nhận diện. Hãy chụp rõ hơn hoặc nhập thủ công.";
  }catch(error){
   if(request!==scanId)return;
   $("#scanStatus").className="scan-status error";
   $("#scanStatus").textContent=(error.message||"Quét bill thất bại")+". Bạn vẫn có thể nhập thủ công.";
   $("#retryScan").hidden=false;toast("Đọc bill thất bại; vẫn nhập thủ công được.");
  }finally{
   if(request===scanId){busyScan=false;$("#cameraBtn").disabled=$("#galleryBtn").disabled=false}
  }
 }
 $("#entryForm").onsubmit=e=>{
  e.preventDefault();
  if(busyScan){toast("Hãy đợi quét hoàn tất trước khi lưu.");return}
  const amount=Number($("#amountInput").value),walletId=$("#walletInput").value,sourceWallet=wallet(walletId);
  const merchant=$("#merchantInput").value.trim(),category=$("#categoryInput").value,date=$("#dateInput").value,time=$("#timeInput").value;
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1_000_000_000){toast("Số tiền phải là số nguyên dương và không vượt 1 tỷ.");return}
  if(!sourceWallet){toast("Hãy chọn ví thanh toán.");return}
  if(receiptFile&&detectedReceiptCurrency&&entryType==="expense"&&detectedReceiptCurrency!==sourceWallet.currency){toast("Bill dùng "+detectedReceiptCurrency+" nhưng ví đang là "+sourceWallet.currency+". Chọn đúng ví hoặc bỏ ảnh.");return}
  if(!validDay(date)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)){toast("Vui lòng kiểm tra ngày và giờ giao dịch.");return}
  if(!merchant&&entryType!=="transfer"){toast("Nhập tên cửa hàng hoặc tên giao dịch.");return}
  const destination=entryType==="transfer"?wallet($("#toWalletInput").value):null;
  if(entryType==="transfer"&&(!destination||destination.id===sourceWallet.id||destination.currency!==sourceWallet.currency)){toast("Chọn hai ví khác nhau, cùng loại tiền.");return}
  if(!editingTxId&&entryType!=="transfer"){
   const duplicate=db.transactions.some(t=>t.type===entryType&&t.amount===amount&&t.currency===sourceWallet.currency&&t.date===date&&t.merchant.toLowerCase()===merchant.toLowerCase());
   if(duplicate&&!confirm("Đã có giao dịch cùng ngày, số tiền và tên. Bạn vẫn muốn lưu thêm?"))return;
  }
  const created=editingTxId?db.transactions.find(tx=>tx.id===editingTxId):null;
  const tx={
   id:created?.id||id(),type:entryType,amount,walletId,
   toWalletId:entryType==="transfer"?destination.id:null,currency:sourceWallet.currency,
   merchant:entryType==="transfer"?"Chuyển ví":merchant,category:entryType==="transfer"?"other":category,
   note:$("#memoInput").value.trim(),date,time,created:created?.created||Date.now(),
   source:created?.source||"manual"
  };
  // Only status is saved, not the receipt image or OCR output.
  if(receiptFile)tx.source="receipt_ocr";
  if(created)db.transactions=db.transactions.map(x=>x.id===editingTxId?tx:x);
  else db.transactions.push(tx);
  if(!store())return;
  overlayClose("entryOverlay");show("transactions");toast("Đã lưu giao dịch ✓");
 };
 $("#deleteTransaction").onclick=()=>{
  if(!editingTxId)return;
  if(!confirm("Xóa giao dịch này khỏi sổ thu chi?"))return;
  db.transactions=db.transactions.filter(tx=>tx.id!==editingTxId);
  if(store()){overlayClose("entryOverlay");toast("Đã xóa giao dịch")}
 };
 function openBudget(budgetId=null){
  const current=db.budgets.find(x=>x.id===budgetId);
  editingBudgetId=budgetId;
  $("#budgetHeading").textContent=current?"Sửa ngân sách":"Tạo ngân sách";
  $("#budgetCategory").innerHTML=options(expenseCategories,current?.category);
  $("#budgetCurrency").innerHTML='<option value="JPY">JPY · Yên Nhật</option><option value="VND">VND · Đồng Việt</option>';
  if(current){$("#budgetCategory").value=current.category;$("#budgetCurrency").value=current.currency}
  $("#budgetAmount").value=current?.amount||"";
  overlayOpen("budgetOverlay");
 }
 $("#newBudgetBtn").onclick=()=>openBudget();
 $("#budgetForm").onsubmit=e=>{
  e.preventDefault();
  const amount=Number($("#budgetAmount").value),category=$("#budgetCategory").value,currency=$("#budgetCurrency").value;
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1_000_000_000){toast("Ngân sách phải là số nguyên dương.");return}
  const existing=db.budgets.find(b=>b.id!==editingBudgetId&&b.category===category&&b.currency===currency);
  if(existing){toast("Danh mục này đã có ngân sách cùng loại tiền.");return}
  const obj={id:editingBudgetId||id(),amount,category,currency};
  if(editingBudgetId)db.budgets=db.budgets.map(b=>b.id===editingBudgetId?obj:b);
  else db.budgets.push(obj);
  if(store()){overlayClose("budgetOverlay");toast("Đã lưu ngân sách")}
 };
 function openWallet(walletId=null){
  const w=db.wallets.find(x=>x.id===walletId);
  editingWalletId=walletId;
  $("#walletHeading").textContent=w?"Sửa ví":"Thêm ví";
  $("#walletName").value=w?.name||"";
  $("#walletCurrency").value=w?.currency||"JPY";
  $("#walletInitial").value=w?.openingBalance||0;
  overlayOpen("walletOverlay");
 }
 $("#addWalletBtn").onclick=()=>openWallet();
 $("#walletForm").onsubmit=e=>{
  e.preventDefault();
  const name=$("#walletName").value.trim(),currency=$("#walletCurrency").value,openingBalance=Number($("#walletInitial").value);
  if(!name||!["JPY","VND"].includes(currency)||!Number.isSafeInteger(openingBalance)||openingBalance<0||openingBalance>1_000_000_000_000){toast("Kiểm tra tên ví, loại tiền và số dư.");return}
  if(editingWalletId&&db.transactions.some(tx=>(tx.walletId===editingWalletId||tx.toWalletId===editingWalletId)&&tx.currency!==currency)){
   toast("Không thể đổi loại tiền cho ví đang có giao dịch.");return;
  }
  const item={id:editingWalletId||id(),name,currency,openingBalance};
  if(editingWalletId)db.wallets=db.wallets.map(w=>w.id===editingWalletId?item:w);
  else db.wallets.push(item);
  if(store()){overlayClose("walletOverlay");toast("Đã lưu ví ✓")}
 };
 function download(filename,blob){
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
 }
 function exportCSV(){
  const columns=["Ngày","Giờ","Loại","Số tiền","Đơn vị","Ví","Ví nhận","Danh mục","Tên giao dịch","Ghi chú","Nguồn"];
  const cell=value=>'"'+String(value??"").replace(/"/g,'""').replace(/^[=+\-@]/,"'"+String(value??"").charAt(0))+'"';
  const rows=sortTransactions(db.transactions).map(t=>[t.date,t.time,t.type,t.amount,t.currency,wallet(t.walletId)?.name||"",wallet(t.toWalletId)?.name||"",label(t.category),t.merchant,t.note,t.source].map(cell).join(","));
  download("ngoc-os-thu-chi-"+dayKey()+".csv",new Blob(["\ufeff"+[columns.map(cell).join(","),...rows].join("\r\n")],{type:"text/csv;charset=utf-8"}));
 }
 function exportJSON(){
  download("ngoc-os-money-backup-"+dayKey()+".json",new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));
 }
 function importJSON(file){
  if(!file||file.size>3_000_000){toast("Bản sao phải là JSON dưới 3 MB.");return}
  file.text().then(text=>{
   const parsed=JSON.parse(text);
   if(!parsed||!Array.isArray(parsed.wallets)||!Array.isArray(parsed.transactions)||!Array.isArray(parsed.budgets))throw Error("Sai định dạng");
   const wallets=parsed.wallets.filter(x=>typeof x.id==="string"&&typeof x.name==="string"&&["JPY","VND"].includes(x.currency)&&Number.isSafeInteger(Number(x.openingBalance))&&Number(x.openingBalance)>=0);
   if(wallets.length!==parsed.wallets.length||wallets.length===0||new Set(wallets.map(x=>x.id)).size!==wallets.length)throw Error("Ví không hợp lệ");
   const walletMap=new Map(wallets.map(w=>[w.id,w]));
   const transactions=parsed.transactions.filter(t=>t&&typeof t.id==="string"&&["expense","income","transfer"].includes(t.type)&&Number.isSafeInteger(t.amount)&&t.amount>0&&t.amount<=1_000_000_000&&validDay(t.date)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.time||"")&&walletMap.has(t.walletId)&&walletMap.get(t.walletId).currency===t.currency&&["JPY","VND"].includes(t.currency)&&typeof t.merchant==="string"&&typeof t.note==="string"&&((t.type!=="transfer"&&!t.toWalletId)||(t.type==="transfer"&&walletMap.has(t.toWalletId)&&t.toWalletId!==t.walletId&&walletMap.get(t.toWalletId).currency===t.currency)));
   if(transactions.length!==parsed.transactions.length||new Set(transactions.map(t=>t.id)).size!==transactions.length)throw Error("Giao dịch không hợp lệ");
   const budgets=parsed.budgets.filter(b=>b&&typeof b.id==="string"&&expenseCategories.includes(b.category)&&["JPY","VND"].includes(b.currency)&&Number.isSafeInteger(b.amount)&&b.amount>0);
   if(budgets.length!==parsed.budgets.length)throw Error("Ngân sách không hợp lệ");
   if(!confirm("Khôi phục sẽ thay thế "+db.transactions.length+" giao dịch và toàn bộ ví/ngân sách hiện tại bằng dữ liệu bản sao. Bạn đã sao lưu chưa?"))return;
   db={version:1,wallets,transactions,budgets,settings:{hideBalance:false,legacyImportDone:false}};
   if(store()){toast("Đã khôi phục bản sao");show("overview")}
  }).catch(error=>toast("Không nhập được JSON: "+(error.message||"sai định dạng")));
 }
 $("#jsonInput").onchange=e=>{const file=e.target.files?.[0];e.target.value="";if(file)importJSON(file)};
 function legacyImport(){
  let old;
  try{old=JSON.parse(localStorage.getItem(LEGACY)||"null")}catch{}
  const candidates=Array.isArray(old?.money)?old.money:[];
  const dated=candidates.filter(x=>validDay(x.date)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x.time||"")&&x.type&&Number(x.amount)>0);
  if(!dated.length){
   toast("Dữ liệu thu chi cũ thiếu ngày hoặc giờ giao dịch: không thể tự nhập an toàn. Bạn có thể thêm thủ công.");return;
  }
  if(!confirm("Có "+dated.length+" khoản thu chi cũ có ngày. Chỉ nhập các giao dịch hợp lệ; kiểm tra lại sau khi nhập. Tiếp tục?"))return;
  let added=0;
  for(const x of dated){
   const key="legacy-"+String(x.id);
   if(db.transactions.some(t=>t.id===key))continue;
   const amount=Number(x.amount);
   if(!Number.isSafeInteger(amount)||amount<=0||amount>1e9)continue;
   db.transactions.push({id:key,type:x.type==="in"?"income":"expense",amount,walletId:db.wallets.find(w=>w.currency==="JPY")?.id||db.wallets[0].id,currency:"JPY",merchant:String(x.title||"Khoản cũ").slice(0,100),note:"Nhập từ Ngọc OS cũ",category:"other",date:x.date,time:x.time,created:Date.now(),source:"legacy"});
   added++;
  }
  if(added&&store())toast("Đã nhập "+added+" giao dịch có ngày; kiểm tra giờ nếu không rõ.");
  else toast("Không có giao dịch mới để nhập.");
 }
 function showHelp(){
  overlayOpen("helpOverlay");
 }
 $$("[data-action]").forEach(b=>b.onclick=()=>{
  const action=b.dataset.action;
  if(action==="settings")showHelp();
  if(action==="exportcsv")exportCSV();
  if(action==="exportjson")exportJSON();
  if(action==="importjson")$("#jsonInput").click();
  if(action==="legacy")legacyImport();
  if(action==="search"){
   const next=prompt("Tìm giao dịch theo tên, danh mục hoặc ghi chú:",searchText);
   if(next===null)return;
   searchText=next.trim();show("transactions");toast(searchText?"Đang tìm: "+searchText:"Đã xóa bộ lọc tìm kiếm");
  }
 });
 renderAll();
})();
