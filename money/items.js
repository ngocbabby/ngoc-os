"use strict";
/* Receipt line-item helpers. Intentionally conservative: no invented products or prices. */
(function initMoneyItems(global){
 const normalize=v=>String(v??"").normalize("NFKC").replace(/\r/g,"").replace(/[\u200b-\u200f]/g,"").trim();
 const maxItems=80;
 const categories=["food","shopping","transport","home","bills","health","study","entertainment","meat","produce","dairy","groceries","household","other"];
 const categorySet=new Set(categories);
 function categorize(name){
  const t=normalize(name).toLowerCase();
  if(/(?:牛乳|ミルク|ヨーグルト|チーズ|バター|乳飲|milk|yogurt|cheese|butter)/i.test(t))return "dairy";
  if(/(?:豚|牛肉|牛肩|牛小間|鶏|鴨|ひき肉|挽肉|精肉|ロース肉|鶏肉|ハム|ベーコン|ウィンナー|ウインナー|ソーセージ|meat|beef|pork|chicken|bacon|sausage)/i.test(t))return "meat";
  if(/(?:キャベツ|きゃべつ|白菜|レタス|トマト|にんじん|人参|玉ねぎ|たまねぎ|もやし|じゃがいも|ナス|なす|きゅうり|胡瓜|大根|ブロッコリー|ほうれん草|しめじ|えのき|きのこ|ねぎ|葱|野菜|バナナ|りんご|リンゴ|みかん|いちご|果物|fruits?|vegetable|tomato|carrot|lettuce|apple|banana)/i.test(t))return "produce";
  if(/(?:洗剤|洗濯|漂白|シャンプー|コンディショナー|ティッシュ|トイレ|ペーパー|石けん|石鹸|柔軟剤|ラップ|アルミホイル|タオル|スポンジ|歯ブラシ|歯みがき|ゴミ袋|掃除|マスク|除菌|dish.?soap|toilet.?paper|laundry|detergent|shampoo|tissue|soap)/i.test(t))return "household";
  if(/(?:ガソリン|軽油|レギュラー|ハイオク|高速道路|乗車券|駐車|ガス給油|diesel|petrol)/i.test(t))return "transport";
  if(/(?:薬|医薬|ビタミン|処方|サプリメント|湿布|bandage|medicine)/i.test(t))return "health";
  if(/(?:米|ごはん|パン|卵|玉子|たまご|豆腐|納豆|麺|うどん|そば|味噌|みそ|醤油|しょうゆ|砂糖|塩|オイル|食用油|おにぎり|弁当|お茶|緑茶|コーヒー|コーラ|ジュース|飲料|ミネラルウォーター|チョコ|スナック|ポテチ|アイス|菓子|ハンバーグ|fish|egg|bread|coffee|juice|rice|water|snack|noodle|sugar|sauce)/i.test(t))return "groceries";
  if(/(?:スカート|ジャケット|Tシャツ|靴下|ソックス|ズボン|スニーカー|洋服|シャツ|clothing|shirt|socks)/i.test(t))return "shopping";
  return "other";
 }
 const totalOrAdjustment=/(?:合\s*計|総\s*計|ご利用金額|お\s*支\s*払|お買上金額|お買い上げ計|税込\s*計|総額|小\s*計|税抜|税額|消費税|内税|外税|税率|税|値引|割引|お値引|クーポン|ポイント|お\s*釣|お\s*つり|釣銭|お預|預り|おつり|支払|現金|カード|クレジット|電子マネー|決済|お支払い|レジ袋代合計|合計点数|商品点数|subtotal|grand\s*total|total|tax|change|discount|coupon|payment|cash\s*tendered)/i;
 const header=/(?:\b20\d{2}[\-/.\s年]\d{1,2}|令和\d{1,2}年|\b\d{1,2}:\d{2}\b|〒|電話|tel[:：\s]|fax|レシート|領収|伝票|レジ(?:No)?|取引|店番号|店舗番号|インボイス|適格|登録番号|お客様|お買い上げ|担当|営業時間|株式会社|合同会社|レジ|商品コード|注文番号|注文日|請求額|請求金額|発行日|支払期限|バーコード|\/www\.|https?:|shop\s*name|receipt|thank\s*you|terminal|store\s*id|no[.:]\s*\d+)/i;
 const standaloneTotal=/^(?:合\s*計|小\s*計|総\s*合\s*計|お\s*支\s*払\s*金\s*額|税込(?:み)?合計|TOTAL|SUBTOTAL|GRAND TOTAL)/i;
 function rawAmount(t){
  const str=normalize(t).replace(/[￥]/g,"¥").replace(/\s+/g,"");
  const match=str.match(/^(?:¥)?(\d{1,3}(?:,\d{3})+|\d{1,9})(?:円)?$/);
  if(!match)return null;
  const num=Number(match[1].replace(/,/g,""));
  return Number.isSafeInteger(num)&&num>=0&&num<=1_000_000_000?num:null;
 }
 function itemFromLine(line,previousName=null){
  const text=normalize(line);
  if(!text||header.test(text)||totalOrAdjustment.test(text)||/\b(?:0[789]0|110)\s*[%％]/.test(text))return null;
  // Japanese receipts usually print the final line total at the far right.
  const match=text.match(/^(.*?)\s*(?:[¥￥]\s*)?(\d{1,3}(?:,\d{3})+|\d{1,8})(?:\s*円)?\s*$/);
  if(!match)return null;
  let front=match[1].trim();
  const amount=rawAmount(match[2]);
  if(amount===null)return null;
  // Do not interpret receipt reference numbers or bare prices as item names.
  if(!front&&previousName)front=normalize(previousName);
  if(!front||front.length<1||front.length>100||/^[\d,.%:()¥￥\s-]+$/.test(front))return null;
  if(/(?:\bNo[.:]?\s*\d+|商品コード|伝票番号|^[#*]\s*\d+)/i.test(front))return null;
  let quantity=1;
  let confidence="medium";
  let qtyMatch=front.match(/(?:^|\s)(\d{1,2})\s*[×xX*]\s*(?:[¥￥]\s*)?\d{1,7}\s*$/);
  if(qtyMatch){
   quantity=Number(qtyMatch[1]);
   front=front.slice(0,qtyMatch.index).trim();
  }else{
   qtyMatch=front.match(/(?:^|\s)(\d{1,2})\s*(?:個|点|本|袋|パック|枚|セット|ボトル|箱|ヶ)\s*(?:[×xX*]\s*)?(?:[¥￥]\s*)?\d{0,7}\s*$/);
   if(qtyMatch){quantity=Number(qtyMatch[1]);front=front.slice(0,qtyMatch.index).trim()}
   else{
    qtyMatch=front.match(/(?:^|\s)[×xX*]\s*(\d{1,2})\s*$/);
    if(qtyMatch){quantity=Number(qtyMatch[1]);front=front.slice(0,qtyMatch.index).trim();confidence="low"}
   }
  }
  if(quantity<1||quantity>99||!front||front.length<1)return null;
  // Some OCR outputs prepend a row number "*".
  front=front.replace(/^[\s*・•]+/,"").replace(/\s*[¥￥]\s*$/,"").trim();
  if(!front||/^[^a-zA-Z\u3040-\u30ff\u3400-\u9fff]+$/.test(front))return null;
  return {name:front.slice(0,100),quantity,amount,category:categorize(front),confidence,source:"ocr"};
 }

 // ぎょうむスーパー / 業務スーパー: JAN rows, product rows and separate 2コ×単100 ￥200 rows.
 // COSTCO: item name followed by SKU, quantity, unit price, extended price, tax flag E.
 const janRow=/^\s*[\d -]{8,17}\s*(?:JAN|JAM|JANコード)\s*$/i;
 const endOfItems=/(?:^|[\s*＊※])(?:小\s*計|税\s*抜\s*計|合\s*計|総\s*合\s*計|お預り|お釣り|外\s*税\s*計|現\s*金\s*計|ご請求合計|TOTAL|SUBTOTAL|GRAND TOTAL|現金|お買上点数|お買上点数|ご利用合計)/i;
 const value=t=>{
  const x=normalize(t).replace(/[,.\s]/g,"");
  return /^\d{1,9}$/.test(x)?Number(x):null;
 };
 function cleanProductName(text){
  return normalize(text).replace(/^(?:0\d{4,7}|\d{5,8})\s*[※＊*]\s*/,"")
   .replace(/^[※＊*・•\s]+/,"").replace(/\s*[¥￥]\s*$/,"").trim();
 }
 function amountQuantity(line){
  const text=normalize(line);
  let m=text.match(/^\s*(\d{1,2})\s*(?:コ|個|点|本|袋|枚|ヶ|パック|箱)?\s*[×Xx*]\s*(?:単価?|@)?\s*[¥￥]?\s*([\d,.]+)(?:\s*[¥￥]\s*([\d,.]+)|\s+([\d,.]+)\s*円?)?\s*$/);
  if(!m)return null;
  const quantity=Number(m[1]),unit=value(m[2]),printed=value(m[3]||m[4]);
  if(quantity<1||quantity>99||!Number.isInteger(unit)||unit<=0)return null;
  const total=Number.isInteger(printed)?printed:quantity*unit;
  if(!Number.isSafeInteger(total)||total<=0||total>1_000_000_000)return null;
  return {quantity,amount:total,unit,confidence:Number.isInteger(printed)?"medium":"low"};
 }
 function costcoRow(line){
  const text=normalize(line).replace(/[◯○●◉・]/g,"@").replace(/[￥¥]/g,"");
  // 78948  1@  688  688 E    |   98414 1@ 3,507 3,507 E
  const m=text.match(/^\s*(\d{4,8})\s+(\d{1,2})\s*[@\s]\s*([\d,.]+)\s+([\d,.]+)\s*(?:[EeAabB])?\s*$/);
  if(!m)return null;
  const quantity=Number(m[2]),unit=value(m[3]),total=value(m[4]);
  if(!Number.isInteger(unit)||!Number.isInteger(total)||quantity<1||quantity>99||total<1||total>1_000_000_000)return null;
  return {quantity,amount:total,confidence:Math.abs(quantity*unit-total)<2?"high":"low"};
 }
 function parseLineItems(lines,context={}){
  const input=(Array.isArray(lines)?lines:String(lines||"").split("\n")).map(normalize).filter(Boolean);
  const merchant=normalize(context.merchant||"");
  const isCostco=/costco|コストコ/i.test(merchant);
  const rows=[],seen=new Set();
  let pending=null,lastResultIndex=-1,lastItemRow=-4;
  for(let i=0;i<input.length&&rows.length<maxItems;i++){
   const line=input[i];
   if(endOfItems.test(line)&&rows.length)break;
   if(janRow.test(line)||/^\s*\d{11,14}\s*(?:JAN|JAM)?\s*$/i.test(line))continue;
   if(totalOrAdjustment.test(line)||header.test(line)||line===merchant||line.length>125){
    if(!/^\s*0?\d{5,8}\s*※/.test(line))pending=null;
    continue;
   }
   const countLine=amountQuantity(line);
   if(countLine){
    if(pending){
     const item={name:pending,quantity:countLine.quantity,amount:countLine.amount,category:categorize(pending),confidence:countLine.confidence,source:"ocr"};
     rows.push(item);lastResultIndex=rows.length-1;lastItemRow=i;pending=null;
    }else if(lastResultIndex>=0&&i-lastItemRow<=3){
     // Quantity details belong to the preceding item, not a second product.
     rows[lastResultIndex].quantity=countLine.quantity;
     rows[lastResultIndex].amount=countLine.amount;
     rows[lastResultIndex].confidence="low";
     lastItemRow=i;
    }
    continue;
   }
   const costco=costcoRow(line);
   if(costco){
    if(pending){
     rows.push({name:pending,quantity:costco.quantity,amount:costco.amount,category:categorize(pending),confidence:costco.confidence,source:"ocr"});
     lastResultIndex=rows.length-1;lastItemRow=i;pending=null;
    }
    continue;
   }
   const item=itemFromLine(line,null);
   if(item){
    const cleaned=cleanProductName(item.name);
    if(!cleaned||!/[a-zA-Z\u3040-\u30ff\u3400-\u9fff]/.test(cleaned)){pending=null;continue}
    item.name=cleaned;item.category=categorize(cleaned);
    rows.push(item);lastResultIndex=rows.length-1;lastItemRow=i;pending=null;continue;
   }
   // Only save plausible product titles as candidates for a subsequent qty/price line.
   const name=cleanProductName(line);
   const mayBeName=name.length>=2&&name.length<=85&&
    /[a-zA-Z\u3040-\u30ff\u3400-\u9fff]/.test(name)&&
    !/^\s*(?:No|伝票|レジ|賞|チNo|クレジット|商品ID|カード会員|消費税|登録番号|電話|CARD|現金|BIZ\/GOLD|ご利用)/i.test(name)&&
    !/^\d{4,}/.test(name)&&
    !/^\s*(?:レジ|取引|店名|営業|ご注文)/.test(name)&&
    (isCostco||/^\s*\d{4,8}\s*[※＊*]|^\s*[※＊*]/.test(line)||/[\u3040-\u30ff\u3400-\u9fff]{3,}/.test(name));
   pending=mayBeName?name:null;
  }
  return rows;
 }
 function validateItem(item){
  return !!item&&typeof item.name==="string"&&item.name.trim().length>=1&&item.name.trim().length<=100&&Number.isSafeInteger(item.quantity)&&item.quantity>=1&&item.quantity<=99&&Number.isSafeInteger(item.amount)&&item.amount>=0&&item.amount<=1_000_000_000&&categorySet.has(item.category);
 }
 function normalItem(item){
  return {name:String(item.name||"").trim().slice(0,100),quantity:Number(item.quantity),amount:Number(item.amount),category:categorySet.has(item.category)?item.category:"other",source:item.source==="ocr"?"ocr":"manual"};
 }
 function allocate(tx){
  if(!tx||tx.type!=="expense"||!Number.isSafeInteger(tx.amount)||tx.amount<0)return {breakdown:{},basis:"invalid",difference:0};
  const items=tx.items;
  if(!Array.isArray(items)||!items.length||items.length>maxItems||!items.every(validateItem))
   return {breakdown:{[tx.category||"other"]:tx.amount},basis:"transaction",difference:0};
  const sum=items.reduce((s,x)=>s+x.amount,0);
  if(!Number.isSafeInteger(sum)||sum>tx.amount)
   return {breakdown:{[tx.category||"other"]:tx.amount},basis:"fallback",difference:sum-tx.amount};
  const out={};
  for(const item of items)out[item.category]=(out[item.category]||0)+item.amount;
  if(tx.amount>sum)out.other=(out.other||0)+(tx.amount-sum);
  return {breakdown:out,basis:sum===tx.amount?"matched":"partial",difference:tx.amount-sum};
 }
 global.MoneyItems={parseLineItems,itemFromLine,categorize,validateItem,normalItem,allocate,maxItems,categories};
})(window);
