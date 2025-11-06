import React, { useEffect, useState } from 'react';
import axios from 'axios';
export default function FailedNotifications(){
  const [rows,setRows]=useState([]);
  const api = import.meta.env.VITE_API_BASE || 'http://localhost:3000/admin';
  useEffect(()=>{ load(); },[]);
  const load=async()=>{
    const key = localStorage.getItem('ADMIN_API_KEY')||'';
    const res = await axios.get(api + '/notifications?limit=100', { headers: { 'x-api-key': key } });
    setRows(res.data.data || []);
  };
  const retryOne = async(id:string)=>{ const key = localStorage.getItem('ADMIN_API_KEY')||''; await axios.post(api + `/notifications/${id}/retry`, {}, { headers:{ 'x-api-key': key } }); load(); };
  const resolveOne=async(id:string)=>{ const key = localStorage.getItem('ADMIN_API_KEY')||''; await axios.post(api + `/notifications/${id}/resolve`, {}, { headers:{ 'x-api-key': key } }); load(); };
  return (<div className='p-6'><h2 className='text-xl mb-4'>Failed Notifications</h2><table className='min-w-full'><thead><tr><th>ID</th><th>Channel</th><th>Error</th><th>Attempts</th><th>Created</th><th>Actions</th></tr></thead><tbody>{rows.map((r:any)=>(<tr key={r.id} className='border-b'><td className='p-2'>{r.id}</td><td className='p-2'>{r.channel}</td><td className='p-2'>{r.last_error}</td><td className='p-2'>{r.attempts}</td><td className='p-2'>{new Date(r.created_at).toLocaleString()}</td><td className='p-2'><button onClick={()=>retryOne(r.id)} className='mr-2 px-2 py-1 bg-green-500 text-white rounded'>Retry</button><button onClick={()=>resolveOne(r.id)} className='px-2 py-1 bg-gray-500 text-white rounded' onClick={()=>resolveOne(r.id)}>Resolve</button></td></tr>))}</tbody></table></div>);
}