"use strict";
const KEY="ngoc_os_cycle_guardian_v1";
const DAY=86400000;
const todayKey=localKey(new Date());
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function localKey(date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0")}
function parseKey(key){if(!/^\d{4}-\d{2}-\d{2}$/.test(key||""))return null;const [y,m,d]=key.split("-").map(Number);const v=new Date(y,m-1,d,12);return v.getFullYear()===y&&v.getMonth()===m-1&&v.getDate()===d?v:null}
function ordinal(key){const date=parseKey(key);return date?Math.round(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/DAY):NaN}
function plusDays(key,days){const d=parseKey(key);if(!d)return null;d.setDate(d.getDate()+days);return localKey(d)}
function diffDays(a,b){return ordinal(a)-ordinal(b)}
function fmt(key,year=false){const d=parseKey(key);return d?d.toLocaleDateString("vi-VN",year?{day:"2-digit",month:"2-digit",year:"numeric"}:{day:"2-digit",month:"2-digit"}):"--"}
function between(day,start,end){return Boolean(start&&end&&day>=start&&day<=end)}
const initialData={
 version:1,
 periods:[
  {id:"p-2026-08-23",start:"2026-08-23",end:null,source:"Ngày bắt đầu trên ảnh; chưa xác nhận kết thúc"},
  {id:"p-2026-10-08",start:"2026-10-08",end:null,source:"Ảnh tham khảo: cần xác nhận ngày hết kinh"}
 ],
 symptoms:[],
 weights:[],
 settings:{cycleBaseline:40,periodDaysBaseline:7,heightCm:155,seeded:true}
};
let db;
function normalize(raw){const result=raw&&typeof raw==="object"?raw:{};return {
 version:1,
 periods:Array.isArray(result.periods)?result.periods.filter(p=>p&&parseKey(p.start)&&(!p.end||parseKey(p.end))&&(!p.end||p.end>=p.start)&&diffDays(todayKey,p.start)>-3650).map(p=>({...p,id:String(p.id||"p-"+p.start)})).sort((a,b)=>a.start.localeCompare(b.start)):[],
 symptoms:Array.isArray(result.symptoms)?result.symptoms.filter(x=>x&&parseKey(x.date)).slice(-2000):[],
 weights:Array.isArray(result.weights)?result.weights.filter(x=>x&&parseKey(x.date)&&Number(x.kg)>=20&&Number(x.kg)<=300).slice(-500):[],
 settings:{cycleBaseline:Number(result.settings?.cycleBaseline)||40,periodDaysBaseline:Number(result.settings?.periodDaysBaseline)||7,heightCm:Number(result.settings?.heightCm)||155,seeded:Boolean(result.settings?.seeded)}
}};
try{db=JSON.parse(localStorage.getItem(KEY)||"null");db=db?normalize(db):structuredClone(initialData)}catch{db=structuredClone(initialData)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));window.dispatchEvent(new Event("cycle-data-changed"))}catch{toast("Không thể lưu dữ liệu. Hãy sao lưu trước khi đóng app.")}render()}
function periods(){return [...db.periods].sort((a,b)=>a.start.localeCompare(b.start))}
function lengths(){const p=periods();return p.slice(1).map((x,i)=>diffDays(x.start,p[i].start)).filter(x=>x>=15&&x<=120)}
function typicalCycle(){const ls=lengths();return ls.length?Math.round(ls.slice(-6).reduce((a,b)=>a+b,0)/Math.min(6,ls.length)):db.settings.cycleBaseline}
function confirmedDays(){const n=periods().filter(p=>p.end).map(p=>diffDays(p.end,p.start)+1).filter(v=>v>=1&&v<=30);return n.length?Math.round(n.reduce((a,b)=>a+b,0)/n.length):null}
function lastPeriod(){return periods().filter(p=>p.start<=todayKey).at(-1)||null}
function currentPeriod(){const p=lastPeriod();return p&&!p.end?p:null}
function rangeEstimate(){const p=lastPeriod();if(!p)return null;const ls=lengths().slice(-6),n=typicalCycle();
 let low,high;if(ls.length>=3){low=Math.max(21,Math.min(...ls)-3);high=Math.min(90,Math.max(...ls)+3)}else{low=Math.max(21,n-6);high=Math.min(90,n+6)}
 return {start:plusDays(p.start,low),end:plusDays(p.start,high),center:plusDays(p.start,n),low,high,confidence:ls.length>=3?"Ước lượng theo lịch sử":"Dữ liệu còn ít; khoảng ước lượng rộng"};
}
function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(message){const t=$("#toast");t.textContent=message;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2700)}
function switchTab(name){$$(".tab").forEach(e=>e.classList.toggle("active",e.id==="tab-"+name));$$(".nav-item").forEach(e=>e.classList.toggle("active",e.dataset.tab===name));window.scrollTo({top:0,behavior:"smooth"});if(name==="calendar")renderCalendar()}
$$(".nav-item").forEach(e=>e.addEventListener("click",()=>switchTab(e.dataset.tab)));
function render(){
 const p=lastPeriod(),active=currentPeriod(),next=rangeEstimate(),ls=lengths();
 const day=p?diffDays(todayKey,p.start)+1:0;
 $("#todayTitle").textContent=!p?"Chu kỳ của bạn 🌸":active?(day<=10?"Ngày hành kinh thứ "+day:"Kỳ kinh chưa kết thúc?"):"Ngày chu kỳ thứ "+day;
 $("#todaySubtitle").textContent=!p?"Chạm bắt đầu kỳ kinh để theo dõi":active?"Đừng quên xác nhận khi kỳ kinh kết thúc":"Chăm sóc cơ thể mỗi ngày";
 $("#orbitDay").textContent=day&&day<100?day:"♡";
 $("#orbitLabel").textContent=active?"Ngày từ khi bắt đầu":"Ngày chu kỳ";
 $("#orbitEmoji").textContent=active?"🩸":"🐱";
 $("#heroBottom").textContent=active?"Bạn có thể ghi nhận triệu chứng trong 10 giây 💗":"Mỗi ghi nhận nhỏ đều hữu ích 💗";
 $("#startPeriodBtn").hidden=Boolean(active);
 $("#endPeriodBtn").hidden=!active;
 $("#setupNudge").hidden=Boolean(p);
 $("#nextPeriodDate").textContent=next?fmt(next.start)+" – "+fmt(next.end):"Chưa đủ dữ liệu";
 $("#nextPeriodHint").textContent=active?"Chưa xác nhận kết thúc kỳ này":next?next.confidence:"Chưa có kỳ kinh";
 $("#lastCycleLength").textContent=ls.length?ls.at(-1)+" ngày":"-- ngày";
 $("#avgCycleHint").textContent=ls.length?"Trung bình "+typicalCycle()+" ngày":"Chưa có đủ 2 kỳ";
 const warning=guardianWarnings(),box=$("#todayAlert");box.className="guardian-card "+(warning.severity||"ok");box.innerHTML="<h3>"+escapeHTML(warning.title)+"</h3><p>"+escapeHTML(warning.message)+"</p>";
 $("#coachTitle").textContent=active?"🐱 Mèo chăm sóc hôm nay":"🐱 Chăm sóc nhẹ nhàng mỗi ngày";
 $("#coachText").textContent=active?"Nếu đau lưng hoặc ê háng, bạn có thể nghỉ ngơi, chườm ấm và ghi nhận khi triệu chứng bất thường.":"Ngủ đủ, vận động vừa sức và không ăn kiêng cực đoan. Những thói quen này hỗ trợ sức khỏe nhưng không bảo đảm làm đều kinh.";
 renderAnalysis();renderCalendar();
}
function guardianWarnings(){
 const active=currentPeriod(),ls=lengths(),s=db.symptoms.filter(x=>diffDays(todayKey,x.date)>=0&&diffDays(todayKey,x.date)<=7);
 if(s.some(x=>x.bleeding==="soaking"||x.dizziness==="yes"&&x.pain==="severe"))return{severity:"urgent",title:"🚨 Cần được đánh giá y tế sớm",message:"Bạn đã ghi dấu hiệu có thể đáng lo. Nếu băng thấm đẫm mỗi giờ trong ít nhất 2 giờ, đặc biệt kèm chóng mặt, ngất, khó thở hoặc đau dữ dội, hãy đi cấp cứu."};
 if(active&&diffDays(todayKey,active.start)+1>8)return{severity:"notice",title:"⚠️ Chưa xác nhận hết kinh",message:"Kỳ kinh bắt đầu "+fmt(active.start,true)+" và vẫn đang để mở. Nếu đã hết, hãy xác nhận đúng ngày; nếu thực sự ra máu hơn 7 ngày, nên trao đổi với bác sĩ."};
 if(ls.some(x=>x>35)||typicalCycle()>35)return{severity:"notice",title:"🩺 Chu kỳ dài hơn thường gặp",message:"Chu kỳ gần nhất "+(ls.at(-1)||"--")+" ngày. Nếu thường kéo dài trên 35 ngày, nhất là kèm tăng cân hoặc kinh thay đổi, nên khám phụ khoa để tìm nguyên nhân. Không tự kết luận PCOS."};
 return {severity:"ok",title:"🌿 Theo dõi đúng cách",message:"Bạn không cần nhập dữ liệu mỗi ngày. App chỉ phân tích những gì đã ghi; dữ liệu thiếu sẽ được đánh dấu chưa xác nhận."}
}
let viewedMonth=new Date();viewedMonth.setDate(1);
let selectedDay=todayKey;
function renderCalendar(){
 $("#monthLabel").textContent=viewedMonth.toLocaleDateString("vi-VN",{month:"long",year:"numeric"});
 const y=viewedMonth.getFullYear(),m=viewedMonth.getMonth(),first=new Date(y,m,1).getDay(),count=new Date(y,m+1,0).getDate(),grid=$("#calendarGrid"),next=rangeEstimate();
 let html="";
 for(let i=0;i<first;i++)html+='<span aria-hidden="true"></span>';
 for(let d=1;d<=count;d++){
 const key=localKey(new Date(y,m,d)),confirmed=periods().some(p=>between(key,p.start,p.end||p.start)),ongoing=Boolean(currentPeriod()&&between(key,currentPeriod().start,todayKey)&&key!==currentPeriod().start),expected=next&&between(key,next.start,next.end)&&!confirmed&&!ongoing,noted=db.symptoms.some(x=>x.date===key);
 html+='<button type="button" class="calendar-day '+(confirmed?"confirmed ":"")+(ongoing?"ongoing ":"")+(expected?"expected ":"")+(key===todayKey?"today ":"")+(key===selectedDay?"selected":"")+'" data-day="'+key+'" aria-label="'+fmt(key,true)+(confirmed?", ngày bắt đầu hoặc ngày kinh đã xác nhận":"")+(ongoing?", đang theo dõi, chưa xác nhận hết kinh":"")+(expected?", ngày dự kiến":"")+'">'+d+(noted?"<i></i>":"")+"</button>";
 }
 grid.innerHTML=html;
 grid.querySelectorAll("button[data-day]").forEach(b=>b.addEventListener("click",()=>{selectedDay=b.dataset.day;renderCalendar()}));
 $("#selectedDayLabel").textContent="Ngày "+fmt(selectedDay,true);
 const logs=db.symptoms.filter(x=>x.date===selectedDay),pp=periods().find(p=>between(selectedDay,p.start,p.end||p.start));
 $("#selectedDayContent").textContent=(pp?"Đã ghi nhận kỳ kinh bắt đầu "+fmt(pp.start,true)+". ":"")+(logs.length?logs.map(x=>"Lượng kinh: "+labelFlow(x.flow)+", đau: "+labelPain(x.pain)+(x.clots?", cục máu: "+labelClots(x.clots):"")+(x.note?", ghi chú: "+x.note:"")).join(" • "):"Chưa có ghi nhận triệu chứng.");
 $("#periodHistory").innerHTML=periods().slice().reverse().map(p=>'<div class="history-item"><div><strong>🩸 '+fmt(p.start,true)+" — "+(p.end?fmt(p.end,true):"Chưa xác nhận kết thúc")+'</strong><small>'+(p.end?diffDays(p.end,p.start)+1+" ngày hành kinh":"Nhấn Sửa để xác nhận hoặc chỉnh lịch sử")+'</small></div><button type="button" data-edit-period="'+escapeHTML(p.id)+'">Sửa</button></div>').join("")||'<p class="detail-text">Chưa ghi kỳ kinh nào.</p>';
 $$("[data-edit-period]").forEach(e=>e.onclick=()=>openPeriodForm(e.dataset.editPeriod))
}
function renderAnalysis(){
 const ls=lengths(),cd=confirmedDays();
 $("#anLastCycle").textContent=ls.length?ls.at(-1)+" ngày":"--";
 $("#anAvgCycle").textContent=ls.length?typicalCycle()+" ngày":"--";
 $("#anAverageSource").textContent=ls.length?"Từ "+Math.min(ls.length,6)+" khoảng chu kỳ":"Cần ít nhất 2 lần bắt đầu";
 $("#anPeriodDays").textContent=cd?cd+" ngày":"--";
 $("#anHistoryCount").textContent=periods().length;
 const ws=[...db.weights].sort((a,b)=>a.date.localeCompare(b.date)),w=ws.at(-1);
 $("#weightLatest").textContent=w?Number(w.kg).toFixed(1)+" kg":"-- kg";
 const bmi=w&&db.settings.heightCm?Number(w.kg)/(db.settings.heightCm/100)**2:null;
 $("#bmiLabel").textContent=bmi?"BMI "+bmi.toFixed(1)+" (không phản ánh vị trí mỡ)":"Chưa nhập cân nặng";
 $("#weightContext").textContent=ws.length<2?"Cân 1 lần/tuần, cùng thời điểm. Giá trị tăng đột ngột có thể liên quan giữ nước.":"Từ "+ws[0].kg+" kg ("+fmt(ws[0].date)+") đến "+w.kg+" kg ("+fmt(w.date)+"). Ưu tiên xu hướng qua nhiều tuần.";
 renderWeightGraph(ws.slice(-12));
 const alerts=[];
 if(ls.some(x=>x>35))alerts.push("🩺 Có chu kỳ trên 35 ngày. Nếu lặp lại, nên khám phụ khoa; tăng cân và kinh thưa có thể cần đánh giá thêm.");
 if(periods().some(p=>p.end&&diffDays(p.end,p.start)+1>7))alerts.push("🩸 Có kỳ kinh kéo dài hơn 7 ngày. Hãy đề cập khi đi khám.");
 if(currentPeriod()&&diffDays(todayKey,currentPeriod().start)+1>8)alerts.push("📌 Kỳ kinh gần nhất chưa xác nhận hết. Hãy chỉnh ngày kết thúc thực tế.");
 if(db.symptoms.some(x=>x.clots==="large"))alerts.push("🩸 Bạn từng ghi nhận cục máu đông lớn. Nên trao đổi với bác sĩ nếu tái diễn.");
 if(!alerts.length)alerts.push("🌸 Chưa có cảnh báo từ dữ liệu đã ghi. Không có cảnh báo không có nghĩa là đã loại trừ bệnh.");
 $("#analysisAlerts").innerHTML=alerts.map(a=>'<div class="mini-alert">'+escapeHTML(a)+"</div>").join("");
}
function renderWeightGraph(ws){
 const el=$("#weightGraph");if(ws.length<2){el.innerHTML='<div class="empty">🌷 Cần ít nhất 2 lần cân để hiển thị xu hướng</div>';return}
 const arr=ws.map(x=>Number(x.kg)),min=Math.min(...arr)-.5,max=Math.max(...arr)+.5,span=max-min||1,w=310,h=112,pad=17;
 const coords=arr.map((v,i)=>({x:pad+i*(w-pad*2)/(arr.length-1),y:pad+(max-v)/span*(h-2*pad)}));
 const path=coords.map((v,i)=>(i?"L":"M")+v.x.toFixed(1)+" "+v.y.toFixed(1)).join(" ");
 el.innerHTML='<svg viewBox="0 0 310 127" role="img" aria-label="Biểu đồ xu hướng cân nặng từ '+escapeHTML(String(arr[0]))+" tới "+escapeHTML(String(arr.at(-1)))+' kg"><path d="'+path+'" fill="none" stroke="#ef5992" stroke-width="3" stroke-linecap="round"/>'+coords.map(c=>'<circle cx="'+c.x+'" cy="'+c.y+'" r="3.5" fill="#ef5992"/>').join("")+'<text x="5" y="124" fill="#94788c" font-size="9">'+fmt(ws[0].date)+'</text><text x="305" y="124" text-anchor="end" fill="#94788c" font-size="9">'+fmt(ws.at(-1).date)+'</text></svg>';
}
const flowLabels={none:"Không",light:"Ít",medium:"Vừa",heavy:"Nhiều",soaking:"Thấm đẫm băng mỗi giờ"};
const painLabels={none:"Không",mild:"Nhẹ",moderate:"Vừa",severe:"Dữ dội"};
const clotLabels={none:"Không",small:"Nhỏ",large:"Lớn (khoảng ≥ 2,5 cm)"};
function labelFlow(k){return flowLabels[k]||"Không rõ"}function labelPain(k){return painLabels[k]||"Không rõ"}function labelClots(k){return clotLabels[k]||"Không rõ"}
function openSheet(title,html,after){$("#sheetTitle").textContent=title;$("#sheetBody").innerHTML=html;$("#sheetBackdrop").hidden=false;document.body.style.overflow="hidden";if(after)after()}
function closeSheet(){$("#sheetBackdrop").hidden=true;document.body.style.overflow=""}
$("#closeSheetBtn").onclick=closeSheet;
$("#sheetBackdrop").addEventListener("click",e=>{if(e.target.id==="sheetBackdrop")closeSheet()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet()});
function openPeriodForm(id=null){
 const existing=db.periods.find(p=>p.id===id),suggested=existing?.start||todayKey;
 openSheet(existing?"Sửa kỳ kinh":"Ghi kỳ kinh 🩸",'<form id="periodForm"><label for="periodStart">Ngày bắt đầu</label><input required type="date" id="periodStart" value="'+suggested+'"><label for="periodEnd">Ngày kết thúc (bỏ trống nếu vẫn đang hành kinh)</label><input type="date" id="periodEnd" value="'+(existing?.end||"")+'"><p class="help">Chỉ nhập ngày thực tế. Nếu chưa hết kinh, để trống và xác nhận sau.</p><div class="button-row"><button type="submit" class="btn primary">Lưu kỳ kinh</button>'+(existing?'<button type="button" id="deletePeriod" class="btn outline">Xóa kỳ này</button>':"")+"</div></form>",()=>{
 const form=$("#periodForm");form.onsubmit=e=>{e.preventDefault();const start=$("#periodStart").value,end=$("#periodEnd").value||null;if(!parseKey(start)||end&&!parseKey(end)||end&&end<start){toast("Kiểm tra lại ngày bắt đầu và kết thúc.");return}if(diffDays(start,todayKey)>0){toast("Chỉ ghi nhận kỳ kinh đã xảy ra.");return}if(end&&diffDays(end,start)>30){toast("Khoảng hành kinh quá dài, hãy kiểm tra lại ngày.");return}
 const collision=db.periods.some(p=>p.id!==id&&p.start===start);if(collision){toast("Ngày bắt đầu này đã có kỳ kinh.");return}
 if(existing){existing.start=start;existing.end=end}else db.periods.push({id:"p-"+Date.now(),start,end,source:"Người dùng xác nhận"});
 db.periods.sort((a,b)=>a.start.localeCompare(b.start));closeSheet();save();toast("Đã lưu kỳ kinh 💗")};
 const del=$("#deletePeriod");if(del)del.onclick=()=>{if(confirm("Bạn chắc chắn muốn xóa kỳ kinh này?")){db.periods=db.periods.filter(p=>p.id!==id);closeSheet();save();toast("Đã xóa kỳ kinh")}}
 })}
function quickLog(date=todayKey){
 const found=db.symptoms.find(x=>x.date===date),options=(map,val)=>Object.entries(map).map(([k,v])=>'<option value="'+k+'" '+(val===k?"selected":"")+'>'+v+"</option>").join("");
 openSheet("Ghi nhận nhanh 🌷",'<form id="symptomForm"><label for="logDate">Ngày ghi nhận</label><input type="date" id="logDate" required value="'+date+'"><div class="row-two"><div><label for="logFlow">Lượng máu</label><select id="logFlow">'+options(flowLabels,found?.flow||"none")+'</select></div><div><label for="logPain">Mức đau</label><select id="logPain">'+options(painLabels,found?.pain||"none")+'</select></div></div><div class="row-two"><div><label for="logClots">Cục máu đông</label><select id="logClots">'+options(clotLabels,found?.clots||"none")+'</select></div><div><label for="logMood">Tâm trạng</label><select id="logMood"><option value="">Không ghi</option><option>Ổn</option><option>Mệt</option><option>Dễ cáu</option><option>Căng thẳng</option></select></div></div><label for="logNotes">Ghi chú (không bắt buộc)</label><textarea id="logNotes" maxlength="350" placeholder="Ê lưng, ê háng, chóng mặt...">'+escapeHTML(found?.note||"")+'</textarea><label class="checkbox-label"><input type="checkbox" id="logDizzy" style="width:auto;min-height:auto"> Có chóng mặt, choáng hoặc ngất</label><p class="help danger">Nếu ra máu thấm đẫm một băng mỗi giờ trong 2 giờ liên tiếp, đặc biệt kèm choáng/ngất hoặc đau dữ dội, hãy đi cấp cứu.</p><button type="submit" class="btn primary full">Lưu trong 10 giây ✓</button></form>',()=>{
 $("#logMood").value=found?.mood||"";$("#logDizzy").checked=found?.dizziness==="yes";
 $("#symptomForm").onsubmit=e=>{e.preventDefault();const date=$("#logDate").value;if(!parseKey(date)||date>todayKey){toast("Ngày ghi nhận không hợp lệ.");return}
 const entry={date,flow:$("#logFlow").value,pain:$("#logPain").value,clots:$("#logClots").value,mood:$("#logMood").value,note:$("#logNotes").value.trim(),dizziness:$("#logDizzy").checked?"yes":"no"};
 db.symptoms=db.symptoms.filter(x=>x.date!==date);db.symptoms.push(entry);selectedDay=date;closeSheet();save();toast("Đã lưu sức khỏe hôm nay 💗")}
 })}
function openWeightForm(){
 const h=db.settings.heightCm;
 openSheet("Theo dõi cân nặng ⚖️",'<form id="weightForm"><label for="weightDate">Ngày cân</label><input type="date" id="weightDate" required value="'+todayKey+'"><div class="row-two"><div><label for="weightKg">Cân nặng (kg)</label><input type="number" id="weightKg" step="0.1" min="20" max="300" required placeholder="52.0"></div><div><label for="heightCm">Chiều cao (cm)</label><input type="number" id="heightCm" step="0.1" min="100" max="230" required value="'+h+'"></div></div><p class="help">Theo dõi 1 lần mỗi tuần. Không kết luận tăng mỡ từ một bữa ăn hoặc một ngày cân.</p><button class="btn primary full" type="submit">Lưu cân nặng</button></form>',()=>{
 $("#weightForm").onsubmit=e=>{e.preventDefault();const date=$("#weightDate").value,kg=Number($("#weightKg").value),height=Number($("#heightCm").value);if(!parseKey(date)||date>todayKey||!(kg>=20&&kg<=300)||!(height>=100&&height<=230)){toast("Kiểm tra lại dữ liệu.");return}
 db.settings.heightCm=height;db.weights=db.weights.filter(x=>x.date!==date);db.weights.push({date,kg});closeSheet();save();toast("Đã lưu cân nặng ⚖️")}
 })}
function reportText(){
 const ls=lengths(),lines=["NGỌC OS · TÓM TẮT SỨC KHỎE CHU KỲ","Ngày xuất: "+fmt(todayKey,true),"","TIẾNG VIỆT","Các kỳ đã ghi: "+periods().map(p=>fmt(p.start,true)+(p.end?" đến "+fmt(p.end,true):" (chưa xác nhận ngày kết thúc)")).join("; "),"Khoảng chu kỳ gần nhất: "+(ls.length?ls.at(-1)+" ngày":"chưa đủ dữ liệu"),"Trung bình từ lịch sử đã nhập: "+(ls.length?typicalCycle()+" ngày":"chưa đủ dữ liệu"),"Số ngày hành kinh trung bình (kỳ đã xác nhận): "+(confirmedDays()||"chưa đủ dữ liệu"),"Cân nặng ghi gần nhất: "+(db.weights.length?[...db.weights].sort((a,b)=>a.date.localeCompare(b.date)).at(-1).kg+" kg":"chưa nhập"),"Triệu chứng đã ghi: "+(db.symptoms.length?db.symptoms.slice(-12).map(x=>fmt(x.date)+" "+labelFlow(x.flow)+" / "+labelPain(x.pain)+" / "+labelClots(x.clots)+(x.note?" / "+x.note:"")).join("; "):"chưa nhập"),"","日本語 · 婦人科受診用","記録した月経開始日: "+periods().map(p=>p.start).join("、"),"直近の月経周期: "+(ls.length?ls.at(-1)+"日":"データ不足"),"記録上の平均周期: "+(ls.length?typicalCycle()+"日":"データ不足"),"記録した月経期間（終了日確認済み）: "+(confirmedDays()||"データ不足")+"日","月経周期が長くなり、体重の変化もあるため相談したいです。","", "これは本人が入力した記録の要約であり、医学的な診断ではありません。"];return lines.join("\n")
}
function openReport(){const r=reportText();openSheet("Báo cáo đi khám 🇯🇵",'<pre class="report-text" id="reportText">'+escapeHTML(r)+'</pre><div class="button-row"><button id="copyReport" class="btn primary" type="button">📋 Sao chép</button><button id="printReportBtn" class="btn soft" type="button">🖨️ In / Lưu PDF</button></div>',()=>{
 $("#copyReport").onclick=async()=>{try{await navigator.clipboard.writeText(r);toast("Đã sao chép báo cáo")}catch{toast("Hãy chọn và sao chép văn bản bên trên")}};
 $("#printReportBtn").onclick=()=>{$("#printReport").textContent=r;window.print()}
 })}
function settingsSheet(){
 openSheet("Cài đặt & bảo mật ⚙️",'<p class="help">🔒 Dữ liệu đang lưu trên trình duyệt của thiết bị này, không tự đồng bộ với điện thoại khác. Không lưu thông tin sức khỏe vào GitHub công khai.</p><label for="baselineCycle">Chu kỳ tham khảo khi chưa đủ lịch sử (ngày)</label><input id="baselineCycle" type="number" min="21" max="90" value="'+db.settings.cycleBaseline+'"><label for="baselinePeriod">Số ngày kinh tham khảo (ngày)</label><input id="baselinePeriod" type="number" min="1" max="15" value="'+db.settings.periodDaysBaseline+'"><button id="saveSettings" type="button" class="btn primary full">Lưu cài đặt</button><hr style="border:0;border-top:1px solid #f3dfe9;margin:20px 0"><h3>💾 Sao lưu và khôi phục</h3><p class="help">Nên sao lưu sau mỗi vài kỳ. Tệp chứa dữ liệu sức khỏe nhạy cảm: cất riêng, không chia sẻ công khai.</p><div class="backup-actions"><button id="exportBackup" class="btn soft" type="button">↓ Xuất JSON</button><label for="importBackup" class="btn outline" style="display:grid;place-items:center;margin:0">↑ Nhập bản sao</label><input id="importBackup" type="file" accept=".json,application/json" hidden></div><button id="clearAll" class="btn outline full" type="button">🗑️ Xóa toàn bộ dữ liệu chu kỳ trên thiết bị</button>',()=>{
 $("#saveSettings").onclick=()=>{const c=Number($("#baselineCycle").value),p=Number($("#baselinePeriod").value);if(c<21||c>90||p<1||p>15){toast("Thông số không hợp lệ.");return}db.settings.cycleBaseline=c;db.settings.periodDaysBaseline=p;closeSheet();save();toast("Đã lưu cài đặt")};
 $("#exportBackup").onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ngoc-os-cycle-backup-"+todayKey+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $("#importBackup").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2_000_000){toast("Tệp quá lớn");return}try{const raw=JSON.parse(await file.text());if(!Array.isArray(raw.periods)||!Array.isArray(raw.symptoms)||!Array.isArray(raw.weights)){toast("Không đúng định dạng sao lưu.");return}if(!confirm("Nhập bản sao sẽ thay thế tất cả dữ liệu chu kỳ hiện tại. Tiếp tục?"))return;db=normalize(raw);closeSheet();save();toast("Đã nhập bản sao lưu")}catch{toast("Không đọc được tệp JSON")}};
 $("#clearAll").onclick=()=>{if(confirm("Bạn muốn xóa TOÀN BỘ dữ liệu chu kỳ trên thiết bị này? Thao tác không hoàn tác được.")&&confirm("Xác nhận lần cuối: xóa toàn bộ?")){db={version:1,periods:[],symptoms:[],weights:[],settings:{cycleBaseline:40,periodDaysBaseline:7,heightCm:155,seeded:false}};closeSheet();save();toast("Đã xóa dữ liệu")}}
 })}
$("#prevMonth").onclick=()=>{viewedMonth.setMonth(viewedMonth.getMonth()-1);renderCalendar()};
$("#nextMonth").onclick=()=>{viewedMonth.setMonth(viewedMonth.getMonth()+1);renderCalendar()};
$("#startPeriodBtn").onclick=()=>openPeriodForm();
$("#endPeriodBtn").onclick=()=>{const p=currentPeriod();if(!p)return;openPeriodForm(p.id)};
$("#addPeriodBtn").onclick=()=>openPeriodForm();
$("#quickLogBtn").onclick=()=>quickLog();
$("#navLogBtn").onclick=()=>quickLog();
$("#sosLogBtn").onclick=()=>quickLog();
$("#addDayLogBtn").onclick=()=>quickLog(selectedDay);
$("#addWeightBtn").onclick=openWeightForm;
$("#settingsBtn").onclick=settingsSheet;
$("#setupBtn").onclick=()=>openPeriodForm();
$("#careReportBtn").onclick=openReport;
$("#analysisReportBtn").onclick=openReport;
render();
