import React, {useEffect, useState} from 'react'
import api from '../utils/api'

export default function FailedMessages(){
  const [rows,setRows] = useState([])
  const [loading,setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/notifications/failed?limit=200').then(r=>{
      setRows(r.data.data || [])
      setLoading(false)
    }).catch(e=> { setLoading(false); console.error(e) })
  }

  useEffect(()=> load(), [])

  const retry = async (id:string) => {
    await api.post(`/notifications/${id}/retry`)
    load()
  }

  const resolve = async (id:string) => {
    await api.post(`/notifications/${id}/resolve`)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Failed Messages</h2>
        <button onClick={load} className="px-3 py-2 bg-blue-600 text-white rounded">Refresh</button>
      </div>

      <div className="space-y-3">
        {loading && <div>Loading...</div>}
        {rows.map((r:any)=> (
          <div key={r.id} className="bg-white p-3 rounded shadow flex justify-between items-start">
            <div>
              <div className="font-medium">{r.recipient_name} ({r.recipient_role})</div>
              <div className="text-sm text-gray-500">{r.channel} • {new Date(r.created_at).toLocaleString()}</div>
              <div className="text-sm mt-2 text-red-600">{r.last_error}</div>
            </div>
            <div className="space-y-2 text-right">
              <button onClick={()=> retry(r.id)} className="px-3 py-1 bg-green-600 text-white rounded">Retry</button>
              <button onClick={()=> resolve(r.id)} className="px-3 py-1 bg-gray-200 rounded">Resolve</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
