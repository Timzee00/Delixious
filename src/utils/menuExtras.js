export function normalizeSelectedExtras(configuredExtras, selectedExtras = []) {
  if (!Array.isArray(selectedExtras) || selectedExtras.length > 20) throw new Error('Invalid food extras selection.');
  const configured = new Map((Array.isArray(configuredExtras) ? configuredExtras : []).map(extra => [extra.id, extra]));
  const seen = new Set();
  return selectedExtras.map(selection => {
    const id=selection?.extra_id, quantity=Number(selection?.quantity), extra=configured.get(id);
    if (!extra || !Number.isSafeInteger(quantity) || quantity<1 || quantity>20 || seen.has(id)) throw new Error('One or more selected extras are no longer valid. Refresh the menu and try again.');
    seen.add(id);
    const unitPriceKobo=Math.round(Number(extra.price)*100);
    if (!Number.isSafeInteger(unitPriceKobo)||unitPriceKobo<0) throw new Error('A food extra has an invalid price.');
    return {extra_id:id,name:extra.name,unit_price_kobo:unitPriceKobo,quantity,line_total_kobo:unitPriceKobo*quantity};
  });
}
export function extrasTotalKobo(snapshot=[]) { return snapshot.reduce((sum,extra)=>sum+extra.line_total_kobo,0); }
