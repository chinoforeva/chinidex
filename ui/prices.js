(function(root){
 'use strict';
 function quote(card){
  // Docker's renderer already selects the authoritative saved provider/printing.
  // Use that same record for totals, coverage and provenance, rather than stale card.price.
  if(typeof window!=='undefined'&&window.ScrydexPrices&&typeof root.cardmarketRecord==='function'){
   const record=root.cardmarketRecord(card),price=record?.general||record?.NM,valid=typeof price?.average==='number'&&Number.isFinite(price.average)&&price.average>=0;
   return {value:valid?price.average:null,currency:price?.currency||null,source:record?.source||null,updatedAt:record?.observedAt||null,metric:record?.general?'medio guardado':record?.NM?'medio NM':'No indicado'};
  }
  if(card?.priceAuthority==='saved-provider'){const value=card.price;return {value:typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null,currency:card.currency||null,source:card.priceSource||null,updatedAt:card.priceUpdatedAt||null,metric:'medio guardado'};}
  let value=card?.price,currency=card?.currency,source=card?.prices?.source||card?.priceSource||null,updatedAt=card?.prices?.updatedAt||card?.priceUpdatedAt||null,metric=card?.prices?.metric||null;
  if(value==null&&card?.pricing?.cardmarket){const p=card.pricing.cardmarket;value=p.avg??p.trend??p.low;currency='EUR';source='Cardmarket';metric=p.avg!=null?'medio':p.trend!=null?'tendencia':'mínimo';}
  if(value==null&&card?.tcgplayer?.prices){const p=card.tcgplayer.prices;value=p.holofoil?.market??p.normal?.market??p.reverseHolofoil?.market;currency='USD';source='TCGplayer';metric='mercado';updatedAt=card.tcgplayer.updatedAt||updatedAt;}
  if(value==null&&card?.pricing?.tcgplayer){const p=card.pricing.tcgplayer;value=p.marketPrice??p.midPrice??p.lowPrice;currency='USD';source='TCGplayer';}
  const valid=value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
  return {value:valid?Number(value):null,currency:/^[A-Z]{3}$/.test(currency||'')?currency:null,source,updatedAt,metric};
 }
 function format(q){if(q.currency==='TIX'&&q.value!=null)return new Intl.NumberFormat('es-ES',{maximumFractionDigits:4}).format(q.value)+' tix';return q.value==null?'Sin precio':q.currency?new Intl.NumberFormat('es-ES',{style:'currency',currency:q.currency}).format(q.value):q.value.toFixed(2)+' (moneda desconocida)';}
 function summarize(cards){
  const totals={},result={totals,priced:0,unknown:0,quantity:0};
  for(const card of cards){const quantity=Number.isSafeInteger(Number(card.quantity))&&Number(card.quantity)>0?Number(card.quantity):1,q=quote(card);result.quantity+=quantity;if(q.value==null||!q.currency){result.unknown+=quantity;continue;}result.priced+=quantity;totals[q.currency]=(totals[q.currency]||0)+q.value*quantity;}
  return result;
 }
 function breakdown(cards){const quoted=[],estimated=[];for(const card of cards)(card.prices?.estimated===true?estimated:quoted).push(card);return {quoted:summarize(quoted),estimated:summarize(estimated)};}
 function summaryText(cards){const groups=breakdown(cards),parts=[];for(const [kind,s] of Object.entries(groups))for(const [currency,value] of Object.entries(s.totals))parts.push(format({value,currency})+(kind==='estimated'?' estimados':''));return parts.join(' + ')||'Sin valor disponible';}
 function compare(a,b,direction=1){const qa=quote(a),qb=quote(b),ma=qa.value==null||!qa.currency,mb=qb.value==null||!qb.currency;if(ma||mb)return Number(ma)-Number(mb);return qa.currency.localeCompare(qb.currency)||direction*(qa.value-qb.value);}
 const api={quote,format,summarize,breakdown,summaryText,compare};if(typeof module!=='undefined')module.exports=api;else root.ChiniPrices=api;
})(globalThis);
