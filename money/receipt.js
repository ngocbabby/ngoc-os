"use strict";
/* Bill OCR and document review. Treat OCR as an unreliable suggestion, never proof of payment. */
(function initMoneyReceipt(global){
 const clean=value=>String(value||"").normalize("NFKC").replace(/\r/g,"").replace(/[\u200b-\u200f]/g,"");
 const compact=value=>clean(value).replace(/[\s　]/g,"");
 function validISO(year,month,day){
  const d=new Date(year,month-1,day,12);
  if(year<2000||year>2100||d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day)return null;
  return String(year)+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");
 }
 function findDate(text){
  const lines=clean(text).split("\n");
  const matches=[];
  const regexes=[
   /(?:^|[^\d])(20\d{2})\s*[/.\-年]\s*(\d{1,2})\s*[/.\-月]\s*(\d{1,2})\s*日?(?=$|[^\d])/g,
   /(?:^|[^\d])(20\d{2})(\d{2})(\d{2})(?=$|[^\d])/g,
   /令\s*和\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/g,
   /\bR\s*(\d{1,2})[./\-](\d{1,2})[./\-](\d{1,2})\b/gi,
   /(?:^|[^\d])(2\d)\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?=$|[^\d])/g
  ];
  lines.forEach((line,i)=>{
   for(let p=0;p<regexes.length;p++){
    regexes[p].lastIndex=0;let match;
    while((match=regexes[p].exec(line))){
     const year=p===2||p===3?2018+Number(match[1]):p===4?2000+Number(match[1]):Number(match[1]);
     const date=validISO(year,Number(match[2]),Number(match[3]));
     if(date){
      const payment=/(?:お買上日|お買い上げ日|注文日|ご注文日|購入日|取引日|お支払日|ご利用日|発行日|日時|日付|order\s*date|purchase\s*date)/i.test(line);
      const wrong=/(?:有効期限|返品期限|配達予定|配送予定|返送期限|賞味期限|消費期限|注文締切|refund\s*by)/i.test(line);
      matches.push({date,score:(payment?4:0)-(wrong?9:0),line:i});
     }
     if(regexes[p].lastIndex===match.index)regexes[p].lastIndex++;
    }
   }
  });
  matches.sort((a,b)=>b.score-a.score||a.line-b.line);
  return matches.find(m=>m.score>=0)?.date||null;
 }
 function findTime(text){
  const lines=clean(text).split("\n");const out=[];
  lines.forEach((line,i)=>{
   const m=line.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：時]\s*([0-5]\d)(?:\s*分)?(?:$|[^\d])/);
   if(!m)return;
   const bad=/(?:返品期限|配送予定|営業時間|開店|閉店|締切|返送期限)/.test(line);
   const good=/(?:お買上|購入|注文|取引|ご利用|発行|日時|時間|時刻)/.test(line);
   out.push({time:String(Number(m[1])).padStart(2,"0")+":"+m[2],score:(good?3:0)-(bad?9:0),i});
  });
  out.sort((a,b)=>b.score-a.score||a.i-b.i);
  return out.find(x=>x.score>=0)?.time||null;
 }
 function classifyDocument(text){
  const t=clean(text),t0=compact(t);
  const returnSignals=/(?:返品する商品|返品手続き|返品手続|返品の注意|返品商品の|返品受付|返品用ラベル|返品対象商品|返送手順|返送手続|返品申請|返金手続|返金処理中|返金予定|returnitems|returnthisitem|returnauthorization|returnlabel|returninstructions)/i;
  if(returnSignals.test(t0))return {type:"return",label:"Trang trả hàng / hoàn tiền",trusted:false,reason:"Đây là hướng dẫn hoặc yêu cầu trả hàng, không phải bằng chứng đã thanh toán."};
  const invoice=/(?:請求書|お支払票|払込票|納付書|料金明細|ご請求額|請求金額|invoice|bill\s*payment|billing\s*statement)/i.test(t);
  const online=/(?:ご注文(?!ありがとうございます)|注文番号|注文内容|注文詳細|注文日時|注文履歴|購入履歴|購入明細|支払完了|決済完了|order\s*(?:number|total|confirmation|details)|purchase\s*confirmed)/i.test(t);
  const receipt=/(?:業\s*務\s*ス\s*[ーｰ]\s*パ\s*[ーｰ]|COSTCO|売\s*上|領収書|領収証|お買上|お買い上げ|レシート|ご利用明細|お支払い金額|お支払額|お会計|総合計|合計金額|税込合計|cashier|receipt|amount\s*paid|grand\s*total)/i.test(t);
  const dated=!!findDate(t);
  const total=/(?:^|[\n\s])(?:総\s*合\s*計|合\s*計|TOTAL)\s*[:：¥￥\s]*\d/m.test(t);
  if(invoice)return {type:"invoice",label:"Hóa đơn / giấy yêu cầu thanh toán",trusted:true,reason:"Ngày trên giấy có thể là ngày phát hành hoặc hạn thanh toán."};
  if(online)return {type:"online",label:"Đơn hàng / thanh toán online",trusted:true,reason:"Thông tin đơn hàng không nhất thiết chứng minh đã trừ tiền."};
  if(receipt||(dated&&total))return {type:"receipt",label:"Hóa đơn mua hàng",trusted:true,reason:"Kiểm tra tổng tiền và thời điểm mua."};
  return {type:"unknown",label:"Không xác định được chứng từ",trusted:false,reason:"Không thấy đủ dấu hiệu hóa đơn hoặc thanh toán. Hãy chọn ảnh bill rõ hơn."};
 }
 function classifyCurrency(text){
  const t=clean(text);
  if(/(?:\bVND\b|VNĐ|₫|đồng|đ(?=[\s\d.,]+$))/im.test(t))return "VND";
  if(/(?:[¥￥]|円|\bJPY\b|税込|お買上|お支払|合計|令和|レシート)/i.test(t))return "JPY";
  return null;
 }
 const totalLabel=/(?:総\s*合\s*計|お\s*支\s*払\s*金\s*額|お支払額|お支払い合計|お買い上げ合計|お買上金額|お買い上げ金額|お会計金額|税込(?:み)?合計|税込(?:み)?総額|合計金額|お\s*買\s*[い上]?\s*上?\s*げ?\s*金額|ご注文合計|ご請求額|ご請求金額|請求金額|ご利用合計|ご利用金額|ご注文金額|合\s*計|現\s*計|合計額|領収金額|お支払い額|お支払金額|grand\s*total|amount\s*(?:due|paid)|total\s*(?:due|amount|paid)?|payment\s*total)/i;
 const rejectTotal=/(?:小\s*計|税\s*抜|消費税|税\s*額|税率|内\s*税|外\s*税|割\s*引|値\s*引|クーポン|お\s*釣り|お\s*つり|お預|預り|釣銭|残高|ポイント|合計点数|商品点数|電話|TEL|注文番号|商品ID|価格|単価|数量|合計数量|送料のみ|subtotal|change|discount|coupon|item\s*price|unit\s*price|tax\s*amount|cash\s*tendered)/i;
 function numbersOn(line){
  let text=clean(line).replace(/[￥]/g,"¥");
  text=text.replace(/(?:20\d{2}|\d{2})[\/.\-]\d{1,2}[\/.\-]\d{1,2}/g," ");
  text=text.replace(/(?:[01]?\d|2[0-3])\s*[:：時]\s*[0-5]\d/g," ");
  const output=[],regexp=/(?:¥\s*)?(\d{1,3}(?:,\d{3})+|\d{1,9})(?:\s*円)?/g;let m;
  while((m=regexp.exec(text))){
   const n=Number(m[1].replace(/,/g,""));
   if(Number.isSafeInteger(n)&&n>0&&n<=1_000_000_000)output.push({value:n,at:m.index});
  }
  return output;
 }
 function findAmount(lines,kind){
  if(kind.type==="return"||kind.type==="unknown")return {amount:null,source:null,identified:false};
  const totals=[];
  lines.forEach((line,i)=>{
   if(!totalLabel.test(line)||rejectTotal.test(line))return;
   const onLine=numbersOn(line).filter(x=>x.value>=10);
   const next=i+1<lines.length?numbersOn(lines[i+1]):[];
   let n=onLine.at(-1)?.value||null;
   if(!n&&next.length&&!rejectTotal.test(lines[i+1])&&lines[i+1].length<45)n=next.at(-1).value;
   if(n){
    const strong=/(?:お支払|お\s*支\s*払|領収金額|お買上金額|合計金額|総\s*合\s*計|請求金額|ご請求|税込合計|お会計|grand total|amount paid|total paid)/i.test(line);
    totals.push({amount:n,source:line,score:(strong?4:2)+i/1000,index:i});
   }
  });
  totals.sort((a,b)=>b.score-a.score||b.index-a.index);
  const best=totals[0];
  return {amount:best?.amount||null,source:best?.source||null,identified:!!best};
 }
 const knownMerchant=/(?:業\s*務\s*ス\s*[ーｰ]\s*パ\s*[ーｰ]|セブン.?イレブン|ファミリーマート|ローソン|イオン|西友|ライフ|マックスバリュ|ツルハ|ウエルシア|スギ薬局|ダイソー|カインズ|ニトリ|ドン.?キホーテ|マツモトキヨシ|スターバックス|マクドナルド|コメダ|すき家|吉野家|コスモ石油|ENEOS|apollostation|コストコ|ヤマダデンキ|コーナン|無印良品|セリア|ユニクロ|Family\s*Mart|7.?Eleven|Lawson|AEON|Costco|Don.?Quijote|McDonald|Starbucks|Rakuten|楽天市場|Amazon|アマゾン|ヨドバシ|ビックカメラ|ヤフーショッピング|Yahoo!\s*ショッピング)/i;
 function findMerchant(lines,kind){
  if(!kind.trusted)return null;
  const first=lines.slice(0,12);
  for(const line of first){
   const m=line.match(knownMerchant);
   if(m)return line.replace(/^\s*[✓•*]\s*/,"").trim().slice(0,75);
  }
  for(const line of first){
   const m=line.match(/(?:^|[^A-Za-z])(?:店舗名|店名|販売者|販売店|店舗|ショップ名|Store\s*Name|Merchant)\s*[:：]\s*(.+)/i);
   if(m&&m[1].trim().length>1)return m[1].trim().slice(0,75);
  }
  // Unknown merchant: be deliberately strict. OCR on arbitrary screenshots can be gibberish.
  const bad=/(?:領収|レシート|合計|明細|伝票|お買|レジ|担当|電話|tel|fax|〒|https?:|www\.|登録|番号|取引|取扱|税|支払|カード|現金|年月日|日付|商品|価格|注文|返品|購入者|出品者|お知らせ|利用規約|^[\d\s.,￥¥\-\/:]+$|[=#[\]<>])/i;
  const found=first.slice(0,6).find(l=>l.length>=3&&l.length<=65&&!bad.test(l)&&!/\d{1,2}:\d{2}/.test(l)&&/[\p{L}]/u.test(l)&&
    (/[一-龯ぁ-ゔァ-ヴー]{2,}/.test(l)||/[A-Za-z]{3,}/.test(l))&&((l.match(/\d/g)||[]).length/l.length)<.25);
  return found||null;
 }
 function parseReceiptText(raw,opts={}){
  const text=clean(raw),lines=text.split("\n").map(x=>x.trim()).filter(Boolean);
  const detected=classifyDocument(text);
  const requested=["auto","receipt","online","invoice","return"].includes(opts.mode)?opts.mode:"auto";
  // Never silently reinterpret a return instruction or a request screen as payment evidence.
  const kind=detected.type==="return"?detected:
   requested!=="auto"?{type:requested,label:({receipt:"Hóa đơn mua hàng",online:"Đơn hàng online",invoice:"Hóa đơn / giấy yêu cầu thanh toán",return:"Thông báo trả hàng"})[requested]||detected.label,trusted:requested!=="return",reason:"Bạn đã chọn loại chứng từ; mọi số liệu vẫn phải được kiểm tra."}:detected;
  const amountResult=findAmount(lines,kind);
  const date=kind.trusted?findDate(text):null;
  const time=kind.trusted?findTime(text):null;
  const merchant=kind.trusted?findMerchant(lines,kind):null;
  const items=kind.type==="receipt"&&global.MoneyItems?global.MoneyItems.parseLineItems(lines,{merchant}):[];
  const currency=classifyCurrency(text);
  const amount=amountResult.amount;
  const score=(amount?3:0)+(date?1:0)+(time?1:0)+(merchant?1:0)+(items.length?1:0);
  const confidence=kind.trusted&&amount&&score>=6?"high":kind.trusted&&amount?"medium":"low";
  const missing=[!amount&&"tổng tiền thanh toán",!merchant&&"tên cửa hàng",!date&&"ngày mua",!time&&"giờ mua"].filter(Boolean);
  return {amount,merchant,date,time,currency,category:global.MoneyItems?.categorize(merchant||"")||"other",items,
   rawText:text,documentType:kind.type,documentLabel:kind.label,documentReason:kind.reason,trustedDocument:kind.trusted,
   confidence,missing,amountSource:amountResult.source,hasTotalEvidence:amountResult.identified,
   needsReview:!kind.trusted||confidence!=="high"};
 }
 let scriptPromise;
 function loadTesseract(){
  if(global.Tesseract)return Promise.resolve(global.Tesseract);
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
   const tag=document.createElement("script");
   tag.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
   tag.crossOrigin="anonymous";tag.async=true;
   tag.onload=()=>global.Tesseract?resolve(global.Tesseract):reject(Error("Không tải được công cụ OCR."));
   tag.onerror=()=>reject(Error("Không tải được công cụ OCR. Hãy kiểm tra mạng."));
   document.head.appendChild(tag);
  }).catch(err=>{scriptPromise=null;throw err});
  return scriptPromise;
 }
 async function prepareImage(file,enhance=false){
  if(!global.createImageBitmap)return file;
  let bitmap;
  try{
   bitmap=await global.createImageBitmap(file);
   const maxSide=3400,size=Math.max(bitmap.width,bitmap.height);
   if(!enhance&&size<=maxSide)return file;
   const scale=Math.min(1,maxSide/size),canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext("2d",{willReadFrequently:enhance});
   if(!ctx)return file;
   ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   if(enhance){
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
    for(let i=0;i<data.length;i+=4){
     const grey=.299*data[i]+.587*data[i+1]+.114*data[i+2];
     const contrasted=Math.max(0,Math.min(255,Math.round((grey-128)*1.55+138)));
     data[i]=data[i+1]=data[i+2]=contrasted;
    }
    ctx.putImageData(pixels,0,0);
   }
   return await new Promise(resolve=>canvas.toBlob(blob=>resolve(blob||file),"image/jpeg",.92));
  }catch{return file}finally{bitmap?.close?.()}
 }
 const quality=p=>(p.trustedDocument?50:0)+(p.amount?25:0)+(p.date?6:0)+(p.time?4:0)+(p.merchant?5:0)+Math.min(10,p.items?.length||0);
 async function recognizeReceipt(file,onProgress=()=>{},opts={}){
  if(!file||!file.type?.startsWith("image/"))throw Error("Hãy chọn ảnh JPG/PNG/WebP.");
  if(file.size>15_000_000)throw Error("Ảnh quá lớn (tối đa 15 MB).");
  const lib=await loadTesseract();
  let worker;
  try{
   onProgress("Đang chuẩn bị bộ OCR tiếng Nhật…",.03);
   worker=await lib.createWorker(["jpn","eng"],1,{logger:event=>{
    if(event.status==="recognizing text")onProgress("Đang đọc chữ…",event.progress||0);
    else if(event.status)onProgress("Đang chuẩn bị bộ OCR…",0);
   }});
   const first=await prepareImage(file,false);
   let raw=(await worker.recognize(first)).data?.text||"";
   let result=parseReceiptText(raw,opts);
   // Improve faint/angled receipt text only when the first pass lacks receipt/payment evidence.
   // Do not waste another expensive OCR pass on an explicit return/other non-bill screen.
   if(opts.enhance===true||(result.documentType!=="return"&&(!result.amount||(!result.date&&!result.items.length)))){
    onProgress("Ảnh khó đọc; đang thử tăng tương phản…",.02);
    const second=await prepareImage(file,true);
    const alternate=(await worker.recognize(second)).data?.text||"";
    const candidate=parseReceiptText(alternate,opts);
    if(quality(candidate)>quality(result)){raw=alternate;result=candidate}
   }
   return result;
  }catch(err){throw Error("Không đọc được ảnh: "+(err?.message||"Lỗi OCR"))}
  finally{if(worker)try{await worker.terminate()}catch{}}
 }
 global.MoneyReceipt={parseReceiptText,recognizeReceipt,classifyDocument,findDate,findTime,findMerchant};
})(window);
