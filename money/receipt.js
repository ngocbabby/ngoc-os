"use strict";
/* Receipt scanner: OCR happens inside the user's browser; receipt images are not posted to an application server. */
(function initMoneyReceipt(global){
 const clean = value => String(value||"").normalize("NFKC").replace(/\r/g,"").replace(/[\u200b-\u200f]/g,"");
 const ISOdate=(year,month,day)=>{
  const d=new Date(year,month-1,day,12);
  if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day||year<2000||year>2100)return null;
  return [year,month,day].map((v,i)=>i===0?String(v):String(v).padStart(2,"0")).join("-");
 };
 function findDate(text){
  const t=clean(text);
  const candidates=[
   /(?:^|[^\d])(20\d{2})[\/.\-年 ]\s*(\d{1,2})[\/.\-月 ]\s*(\d{1,2})日?(?=$|[^\d])/g,
   /\b(20\d{2})(\d{2})(\d{2})\b/g,
   /令和\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})日?/g,
   /\b(2\d)[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/g
  ];
  for(let i=0;i<candidates.length;i++){
   const match=candidates[i].exec(t);
   if(!match)continue;
   const year=i===2?2018+Number(match[1]):i===3?2000+Number(match[1]):Number(match[1]);
   const result=ISOdate(year,Number(match[2]),Number(match[3]));
   if(result)return result;
  }
  return null;
 }
 function findTime(text){
  const t=clean(text);
  const m=t.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：時]\s*([0-5]\d)(?:\s*分)?(?:$|[^\d])/m);
  return m?String(Number(m[1])).padStart(2,"0")+":"+m[2]:null;
 }
 const isTotal = line=>/(?:総\s*合\s*計|小計を含む合計|お\s*支\s*払\s*金\s*額|お\s*買\s*[い上]?\s*上?\s*げ?\s*金額|ご利用金額|ご請求額|合\s*計|税込\s*計|請求\s*金額|grand\s*total|total\s*(?:due|amount)?|amount\s*due)/i.test(line);
 const excluded = line=>/(?:小\s*計|税\s*抜|内\s*税|外\s*税|消費税|税\s*額|税率|お\s*釣り|お\s*つり|釣\s*銭|お\s*預|預り|預かり|カード番号|電話|tel[:：]|ポイント|割\s*引|クーポン|合計点数|還元|残高|subtotal|change|tax(?:es)?\b|discount|cash\s*tendered)/i.test(line);
 function numbersOn(line){
  let t=clean(line);
  // Remove date, time and common barcode-style strings before looking for an amount.
  t=t.replace(/(?:20\d{2}|\d{2})[\/-]\d{1,2}[\/-]\d{1,2}/g," ");
  t=t.replace(/(?:[01]?\d|2[0-3]):[0-5]\d/g," ");
  const items=[];
  const tokens=t.match(/(?:[¥￥]\s*)?\d{1,3}(?:[,.]\d{3})+(?:[,.]00)?(?:\s*円)?|(?:[¥￥]\s*)?\d{1,9}(?:\s*円)?/g)||[];
  for(const token of tokens){
   const match=token.match(/\d[\d.,]*/);
   if(!match)continue;
   let numberString=match[0].replace(/[,.]/g,"");
   // Ignore OCR residue ending in decimals like 1200.00, common on imported receipts.
   if(/[,.]00$/.test(match[0])&&match[0].includes("."))numberString=numberString.slice(0,-2);
   const amount=Number(numberString);
   if(Number.isSafeInteger(amount)&&amount>=1&&amount<=1_000_000_000)items.push(amount);
  }
  return items;
 }
 function categoryFrom(text){
  const s=clean(text).toLowerCase();
  if(/(?:ローソン|ファミリーマート|ファミマ|セブン.?イレブン|イオン|aeon|西友|seiyu|ライフ|スーパー|業務スーパー|ドラッグストア|welcia|マックスバリュ|familymart|lawson|7.?eleven|don.?ki|ドンキ|コストコ)/i.test(s))return "shopping";
  if(/(?:飲食|マクドナルド|mos\s*burger|バーガー|カフェ|coffee|starbucks|スターバックス|すき家|吉野家|松屋|レストラン|ラーメン|食堂|飲み物|居酒屋|カレー|焼肉|うどん|弁当)/i.test(s))return "food";
  if(/(?:ガソリン|出光|eneos|コスモ石油|apollostation|petrol|出光興産|燃料)/i.test(s))return "transport";
  if(/(?:病院|薬局|歯科|診療|クリニック|処方箋)/i.test(s))return "health";
  if(/(?:家賃|ガス料金|水道料金|電気料金|携帯料金|通信料金)/i.test(s))return "bills";
  return "other";
 }
 function findMerchant(lines){
  const known=/(?:セブン.?イレブン|ファミリーマート|ローソン|イオン|西友|ライフ|ツルハ|ウエルシア|スギ薬局|ダイソー|カインズ|ニトリ|ダイキン|ドラッグストア|ドン.?キホーテ|マツモトキヨシ|スターバックス|マクドナルド|コメダ|すき家|吉野家|コスモ石油|ENEOS|apollostation|コストコ|ヤマダデンキ|コーナン|無印良品|セリア|ユニクロ|GU|Lawson|Family\s*Mart|7-Eleven|AEON|Costco|Don.?Quijote|McDonald|Starbucks)/i;
  for(const l of lines.slice(0,20)){const m=l.match(known);if(m)return l.slice(0,75)}
  const skip=/(?:^.{0,2}$|領収|レシート|合計|伝票|お買|レジ|担当|電話|tel|fax|〒|https?:|www\.|登録|番号|店舗番号|取引|取扱|税|支払|カード|現金|年月日|日付|[-_=]{3}|^[\d\s.,￥¥\-\/:]+$)/i;
  const found=lines.slice(0,7).find(l=>l.length>=3&&l.length<=55&&!skip.test(l));
  return found||null;
 }
 function parseReceiptText(text){
  const source=clean(text);
  const lines=source.split("\n").map(s=>s.trim()).filter(Boolean);
  const date=findDate(source),time=findTime(source),merchant=findMerchant(lines);
  const currency=/(?:VND|₫|(?<![A-Za-z])đ(?=\s|\d)|VNĐ|đồng)/i.test(source)?"VND":"JPY";
  let amount=null,amountSource=null,score=0;
  const totals=[];
  for(let i=0;i<lines.length;i++){
   const line=lines[i];if(!isTotal(line)||excluded(line))continue;
   const here=numbersOn(line);
   const next=i+1<lines.length?numbersOn(lines[i+1]):[];
   if(here.length)totals.push({value:here.at(-1),line,priority:2,index:i});
   else if(next.length&&!excluded(lines[i+1]))totals.push({value:next.at(-1),line:line+" / "+lines[i+1],priority:1,index:i});
  }
  if(totals.length){
   // The last "total" on a receipt is usually the final amount after coupons/tax.
   totals.sort((a,b)=>a.priority-b.priority||a.index-b.index);
   const best=totals.at(-1);
   amount=best.value;amountSource=best.line;score+=2;
  }else{
   const possible=[];
   for(let i=0;i<lines.length;i++){
    const line=lines[i];if(excluded(line)||isTotal(line)||/(?:\d{2}[:：]\d{2}|20\d{2}[\/\-.年])/.test(line))continue;
    for(const v of numbersOn(line))if(v>=10)possible.push(v);
   }
   // A maximum line-item price is not reliably the receipt total: leave blank.
   if(possible.length===1){amount=possible[0];amountSource="Không tìm thấy nhãn tổng; chỉ có một số tiền";score+=0}
  }
  if(date)score++;
  if(time)score++;
  if(merchant)score++;
  const category=categoryFrom((merchant||"")+" "+lines.slice(0,5).join(" "));
  return {
   amount,merchant,date,time,currency,category,rawText:source,
   confidence:!amount?"low":score>=5?"high":score>=3?"medium":"low",
   amountSource,missing:[!amount&&"số tiền",!merchant&&"tên cửa hàng",!date&&"ngày",!time&&"giờ"].filter(Boolean)
  };
 }
 let scriptPromise;
 function loadTesseract(){
  if(global.Tesseract)return Promise.resolve(global.Tesseract);
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
   const tag=document.createElement("script");
   tag.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
   tag.crossOrigin="anonymous";
   tag.async=true;
   tag.onload=()=>global.Tesseract?resolve(global.Tesseract):reject(Error("Tesseract không khả dụng"));
   tag.onerror=()=>reject(Error("Không tải được bộ OCR. Hãy kiểm tra mạng."));
   document.head.appendChild(tag);
  }).catch(error=>{scriptPromise=null;throw error});
  return scriptPromise;
 }
 async function prepareImage(file){
  if(!global.createImageBitmap)return file;
  let bitmap;
  try{
   bitmap=await global.createImageBitmap(file);
   const largest=Math.max(bitmap.width,bitmap.height);
   if(largest<=2050)return file;
   const scale=2050/largest;
   const canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));
   canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext("2d");
   if(!ctx)return file;
   ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   return await new Promise(resolve=>canvas.toBlob(blob=>resolve(blob||file),"image/jpeg",.9));
  }catch{return file}
  finally{bitmap?.close?.()}
 }
 async function recognizeReceipt(file,onProgress=()=>{}){
  if(!file||!file.type.startsWith("image/"))throw Error("Hãy chọn ảnh hóa đơn (JPG/PNG/WebP).");
  if(file.size>15_000_000)throw Error("Ảnh quá lớn (tối đa 15 MB).");
  onProgress("Đang tải công cụ đọc bill…",.02);
  const lib=await loadTesseract();
  let worker;
  try{
   worker=await lib.createWorker(["jpn","eng"],1,{logger:event=>{
    if(event.status==="recognizing text")onProgress("Đang nhận diện ký tự…",event.progress||0);
    else if(event.status)onProgress("Đang chuẩn bị nhận diện…",0);
   }});
   const input=await prepareImage(file);
   const result=await worker.recognize(input);
   return parseReceiptText(result.data?.text||"");
  }catch(error){
   throw Error("Không đọc được bill: "+(error?.message||"Lỗi OCR"));
  }finally{if(worker)try{await worker.terminate()}catch{}}
 }
 global.MoneyReceipt={parseReceiptText,recognizeReceipt,categoryFrom,findDate,findTime};
})(window);
