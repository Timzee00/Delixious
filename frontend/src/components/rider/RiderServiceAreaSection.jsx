import { useEffect, useState } from 'react';
import api from '../../lib/api.js';

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function RiderServiceAreaSection() {
  const [form,setForm]=useState({state:'',lat:'',lng:'',radius_km:''});
  const [verified,setVerified]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [locating,setLocating]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  useEffect(()=>{
    let active=true;
    api.get('/delivery/service-area').then(({data})=>{
      if(!active)return;
      const area=data.service_area||{};
      setForm({state:area.rider_operating_state||'',lat:area.rider_base_lat??'',lng:area.rider_base_lng??'',radius_km:area.rider_service_radius_km??''});
      setVerified(Boolean(area.rider_service_area_verified));
    }).catch(err=>{if(active)setError(err.response?.data?.error||'Could not load your operating area.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);

  function useLocation(){
    if(!navigator.geolocation){setError('Location services are unavailable. Enter coordinates manually.');return;}
    setLocating(true);setError('');
    navigator.geolocation.getCurrentPosition(pos=>{
      setForm(current=>({...current,lat:String(pos.coords.latitude),lng:String(pos.coords.longitude)}));
      setLocating(false);
    },()=>{setError('Could not obtain your location. Enter the approved operating base coordinates manually.');setLocating(false);},
    {enableHighAccuracy:true,timeout:15000,maximumAge:60000});
  }

  async function submit(event){
    event.preventDefault();setSaving(true);setError('');setMessage('');
    try{
      const {data}=await api.put('/delivery/service-area',{
        state:form.state,lat:Number(form.lat),lng:Number(form.lng),radius_km:Number(form.radius_km),
      });
      setVerified(Boolean(data.service_area?.rider_service_area_verified));
      setMessage(data.message||'Operating area submitted for administrator verification.');
    }catch(err){setError(err.response?.data?.error||'Could not save your operating area.');}
    finally{setSaving(false);}
  }

  if(loading)return <p role="status" className="text-sm text-ink-soft">Loading operating area…</p>;
  return <section className="max-w-2xl rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
    <h2 className="font-display text-xl font-bold text-ink">Your delivery operating area</h2>
    <p className="mt-1 text-sm leading-6 text-ink-soft">Submit the state and base location where you operate, plus the maximum radius you can reliably cover. An administrator must verify it before delivery jobs appear. Updating this information resets verification.</p>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-sm font-semibold text-ink">Operating state
        <select value={form.state} onChange={event=>setForm(current=>({...current,state:event.target.value}))} required className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm">
          <option value="">Select state</option>{STATES.map(value=><option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-ink">Base latitude
          <input type="number" step="any" min="-90" max="90" required value={form.lat} onChange={event=>setForm(current=>({...current,lat:event.target.value}))} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm"/>
        </label>
        <label className="block text-sm font-semibold text-ink">Base longitude
          <input type="number" step="any" min="-180" max="180" required value={form.lng} onChange={event=>setForm(current=>({...current,lng:event.target.value}))} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm"/>
        </label>
      </div>
      <button type="button" onClick={useLocation} disabled={locating} className="text-sm font-semibold text-pepper hover:underline disabled:opacity-50">{locating?'Getting current location…':'Use current location to prefill base coordinates'}</button>
      <label className="block text-sm font-semibold text-ink">Maximum operating radius (km)
        <input type="number" step="0.5" min="1" max="100" required value={form.radius_km} onChange={event=>setForm(current=>({...current,radius_km:event.target.value}))} placeholder="Enter your service radius" className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm"/>
      </label>
      <p className="text-xs leading-5 text-ink-soft">The radius is measured from your submitted base point for pickup and customer delivery eligibility. It is a straight-line estimate, not a road-route calculation.</p>
      {verified&&<p role="status" className="rounded-lg bg-jade-soft px-3 py-2 text-sm text-jade">Your operating area is verified.</p>}
      {message&&<p role="status" className="rounded-lg bg-jade-soft px-3 py-2 text-sm text-jade">{message}</p>}
      {error&&<p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-pepper px-5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Submitting…':'Save operating area'}</button>
    </form>
  </section>;
}
