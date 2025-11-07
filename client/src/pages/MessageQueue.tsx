import React, {useEffect, useState} from 'react'
import api from '../utils/api'

export default function MessageQueue(){
  const [byChannel, setByChannel] = useState([])
  const [statusCounts, setStatusCounts] = useState([])
  const [filterChannel, setFilterChannel] = useState('all')

  useEffect(()=>{
    api.get('/analytics/notifications/channel').then(r=> setByChannel(r.data.data || []))
    api.get('/notifications/summary').then(r=> setStatusCounts(r.data.data || []))
  },[])

  const channels = byChannel.map((c:any)=> c.channel)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Message Queue</h2>
        <div>
          <label className="text-sm mr-2">Channel</label>
          <select value={filterChannel} onChange={e=> setFilterChannel(e.target.value)} className="border px-2 py-1 rounded">
            <option value="all">All</option>
            {channels.map((ch:any)=> <option key={ch} value={ch}>{ch}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-3">
        {statusCounts.map((s:any)=> (
          <div key={s.status} className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">{s.status}</div>
            <div className="text-2xl font-bold">{s.total}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Channels</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byChannel.map((c:any)=> (
            <div key={c.channel} className="bg-white p-4 rounded shadow">
              <div className="font-medium">{c.channel}</div>
              <div className="text-sm text-gray-500">Total: {c.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
