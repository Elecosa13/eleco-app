'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type SousDossier = { id: string; nom: string; chantier_id: string }
type Chantier = { id: string; nom: string }

export default function ChantierPage() {
  const router = useRouter()
  const params = useParams()
  const chantierId = params.id as string
  const [chantier, setChantier] = useState<Chantier | null>(null)
  const [sousDossiers, setSousDossiers] = useState<SousDossier[]>([])
  const [nouveauSD, setNouveauSD] = useState('')
  const [ajout, setAjout] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('eleco_user')
    if (!stored) { router.push('/'); return }
    charger()
  }, [chantierId])

  async function charger() {
    const { data: c } = await supabase.from('chantiers').select('*').eq('id', chantierId).single()
    if (c) setChantier(c)
    const { data: sd } = await supabase.from('sous_dossiers').select('*').eq('chantier_id', chantierId).order('created_at')
    if (sd) setSousDossiers(sd)
  }

  async function ajouterSD(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('sous_dossiers').insert({ chantier_id: chantierId, nom: nouveauSD })
    setNouveauSD(''); setAjout(false); charger()
  }

  return (
    <div>
      <div className="top-bar">
        <div>
          <button onClick={() => router.push('/employe')} style={{
            background: 'none', border: 'none', color: '#185FA5', fontSize: '13px', cursor: 'pointer', padding: 0
          }}>← Retour</button>
          <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '4px' }}>{chantier?.nom}</div>
        </div>
      </div>

      <div className="page-content">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Sous-dossiers</span>
            <button className="btn-primary btn-sm" style={{ width: 'auto', borderRadius: '6px' }} onClick={() => setAjout(!ajout)}>
              + Nouveau
            </button>
          </div>

          {ajout && (
            <form onSubmit={ajouterSD} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input type="text" placeholder="Nom du sous-dossier" value={nouveauSD}
                onChange={e => setNouveauSD(e.target.value)} required style={{ flex: 1 }} />
              <button type="submit" className="btn-primary btn-sm" style={{ width: 'auto', borderRadius: '6px' }}>OK</button>
            </form>
          )}

          {sousDossiers.length === 0 && !ajout && (
            <div style={{ fontSize: '13px', color: '#888', padding: '10px 0' }}>
              Aucun sous-dossier — ajoute-en un !
            </div>
          )}

          {sousDossiers.map(sd => (
            <div key={sd.id} className="row-item" style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/employe/rapport/${sd.id}`)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '8px',
                  background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                }}>📁</div>
                <div style={{ fontWeight: 500, fontSize: '13px' }}>{sd.nom}</div>
              </div>
              <span style={{ color: '#185FA5', fontSize: '18px' }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
