import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function DeliveryZonesSection() {
  const [zones,setZones]=useState([]);
  const [state,setState]=useState('Lagos');
  const [form,setForm]=useState({base_fee_naira:'',per_km_fee_naira:'',included_distance_km:'0',max_distance_km:'',is_active:false});
  const [interstate,setInterstate]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  useEffect(()=>{
    let active=true;
    adminApi.listDeliveryZones().then(({data})=>{
      if(!active)return;
      setZones(data.zones||[]);
      setInterstate(Boolean(data.allow_interstate_delivery));
      const zone=(data.zones||[]).find(row=>row.state===state);
      if(zone)setForm({base_fee_naira:zone.base_fee_kobo==null?'':String(zone.base_fee_kobo/100),per_km_fee_naira:zone.per_km_fee_kobo==null?'':String(zone.per_km_fee_kobo/100),included_distance_km:String(zone.included_distance_km??0),max_distance_km:zone.max_distance_km==null?'':String(zone.max_distance_km),is_active:Boolean(zone.is_active)});
    }).catch(err=>{if(active)setError(err.response?.data?.error||'Could not load delivery zones.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);

  function selectState(value){
    setState(value);setMessage('');setError('');
    const zone=zones.find(row=>row.state===value);
    setForm(zone?{base_fee_naira:zone.base_fee_kobo==null?'':String(zone.base_fee_kobo/100),per_km_fee_naira:zone.per_km_fee_kobo==null?'':String(zone.per_km_fee_kobo/100),included_distance_km:String(zone.included_distance_km??0),max_distance_km:zone.max_distance_km==null?'':String(zone.max_distance_km),is_active:Boolean(zone.is_active)}:{base_fee_naira:'',per_km_fee_naira:'',included_distance_km:'0',max_distance_km:'',is_active:false});
  }

  async function save(event){
    event.preventDefault();setSaving(true);setError('');setMessage('');
    try{
      const {data}=await adminApi.saveDeliveryZone(state,{
        base_fee_naira:Number(form.base_fee_naira),per_km_fee_naira:Number(form.per_km_fee_naira),
        included_distance_km:Number(form.included_distance_km),max_distance_km:Number(form.max_distance_km),is_active:form.is_active,
      });
      setZones(current=>[...current.filter(zone=>zone.state!==state),data.zone].sort((a,b)=>a.state.localeCompare(b.state)));
      setMessage(data.message||'Delivery zone saved.');
    }catch(err){setError(err.response?.data?.error||'Could not save delivery zone.');}
    finally{setSaving(false);}
  }

  async function toggleInterstate(event){
    const enabled=event.target.checked;setInterstate(enabled);setError('');
    try{await adminApi.setInterstateDelivery(enabled);setMessage(enabled?'Interstate delivery has been enabled.':'Interstate delivery has been disabled.');}
    catch(err){setInterstate(!enabled);setError(err.response?.data?.error||'Could not update interstate setting.');}
  }

  if(loading)return <p role="status" className="text-sm text-ink-soft">Loading delivery zones…</p>;
  return <section className="max-w-3xl space-y-5">
    <div><h2 className="font-display text-xl font-bold text-ink">Delivery zones and pricing</h2><p className="mt-1 text-sm leading-6 text-ink-soft">Configure each state’s customer-paid delivery rates and maximum service distance. Zones stay inactive until you explicitly activate them.</p></div>
    <div className="rounded-2xl border border-hairline bg-paper p-5">
      <label className="flex items-start gap-3 text-sm font-semibold text-ink"><input type="checkbox" checked={interstate} onChange={toggleInterstate} className="mt-1 h-4 w-4"/>Allow interstate delivery</label>
      <p className="mt-1 pl-7 text-xs text-ink-soft">This is a global exception. State zones and rider operating-area restrictions still apply.</p>
    </div>
    <form onSubmit={save} className="rounded-2xl border border-hairline bg-paper p-5">
      <label className="block text-sm font-semibold text-ink">State
        <select value={state} onChange={event=>selectState(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm">{STATES.map(value=><option key={value} value={value}>{value}</option>)}</select>
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink">Base fee (₦)<input type="number" min="0" step="0.01" required value={form.base_fee_naira} onChange={event=>setForm(current=>({...current,base_fee_naira:event.target.value}))} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm"/></label>
        <label className="text-sm font-semibold text-ink">Additional fee per km (₦)<input type="number" min="0" step="0.01" required value={form.per_km_fee_naira} onChange={event=>setForm(current=>({...current,per_km_fee_naira:event.target.value}))} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm"/></label>
        <label className="text-sm font-semibold text-ink">Included distance (km)<input type="number" min="0" step="0.1" required value={form.included_distance_km} onChange={event=>setForm(current=>({...current,included_distance_km:event.target.value}))} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm"/></label>
        <label className="text-sm font-semibold text-ink">Maximum restaurant-to-customer distance (km)<input type="number" min="1" max="300" step="0.1" required value={form.max_distance_km} onChange={event=>setForm(current=>({...current,max_distance_km:event.target.value}))} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm"/></label>
      </div>
      <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-ink"><input type="checkbox" checked={form.is_active} onChange={event=>setForm(current=>({...current,is_active:event.target.checked}))} className="h-4 w-4"/>Activate delivery in this state</label>
      <p className="mt-3 text-xs leading-5 text-ink-soft">Fee formula: base fee + per-kilometre fee after the included distance. Distance uses straight-line coordinates, not road routing.</p>
      {error&&<p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {message&&<p role="status" className="mt-4 rounded-lg bg-jade-soft px-3 py-2 text-sm text-jade">{message}</p>}
      <button type="submit" disabled={saving} className="mt-5 min-h-11 rounded-xl bg-pepper px-5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving…':'Save zone'}</button>
    </form>
    <div className="rounded-2xl border border-hairline bg-paper p-5">
      <h3 className="font-semibold text-ink">Configured zones</h3>
      {zones.length===0?<p className="mt-2 text-sm text-ink-soft">No states have been configured yet.</p>:<div className="mt-3 divide-y divide-hairline">{zones.map(zone=><div key={zone.state} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-medium text-ink">{zone.state}</span><span className="text-xs text-ink-soft">{zone.is_active?'Active':'Inactive'} · {zone.max_distance_km??'—'} km max</span></div>)}</div>}
    </div>
  </section>;
}
