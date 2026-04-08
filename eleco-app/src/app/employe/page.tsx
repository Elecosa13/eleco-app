'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type User = { id: string; prenom: string; role: string; initiales: string }
type Chantier = { id: string; nom: string; adresse: string }

export default function EmployePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [vue, setVue] = useState<'accueil' | 'nouveau'>('accueil')
  const [nomChantier, setNomChantier] = useState('')
  const [adresse, setAdresse] = useState('')
  const [sousDossier, setSousDossier] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('eleco_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.role !== 'employe') { router.push('/admin'); return }
    setUser(u)
    chargerChantiers()
  }, [])

  async function chargerChantiers() {
    const { data } = await supabase
      .from('chantiers')
      .select('*')
      .eq('actif', true)
      .order('created_at', { ascending: false })
    if (data) setChantiers(data)
  }

  async function creerChantier(e: React.FormEvent) {
    e.preventDefault()
    const { data: chantier } = await supabase
      .from('chantiers')
      .insert({ nom: nomChantier, adresse })
      .select()
      .single()
    if (chantier && sousDossier) {
      await supabase.from('sous_dossiers').insert({ chantier_id: chantier.id, nom: sousDossier })
    }
    setNomChantier(''); setAdresse(''); setSousDossier('')
    setVue('accueil')
    chargerChantiers()
  }

  function deconnecter() {
    localStorage.removeItem('eleco_user')
    router.push('/')
  }

  if (!user) return null

  return (
    <div>
      {/* TOP BAR */}
      <div className="top-bar">
        <div>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>
            {vue === 'accueil' ? `Bonjour, ${user.prenom.charAt(0).toUpperCase() + user.prenom.slice(1)}` : 'Nouveau chantier'}
          </div>
          <div style={{ fontSize: '11px', color: '#888' }}>Espace employé</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {vue !== 'accueil' && (
            <button className="btn-outline btn-sm" onClick={() => setVue('accueil')}>← Retour</button>
          )}
          <span className="badge badge-blue" style={{ fontSize: '10px' }}>Employé</span>
          <button className="avatar" onClick={deconnecter} title="Déconnexion">{user.initiales}</button>
        </div>
      </div>

      <div className="page-content">
        {vue === 'accueil' && (
          <>
            {/* Bandeau sécurité */}
            <div className="locked-banner">
              <span>🔒</span>
              <span>Accès limité — aucun prix ni donnée financière visible</span>
            </div>

            {/* Chantiers */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Chantiers actifs</span>
                <button className="btn-primary btn-sm" style={{ width: 'auto', borderRadius: '6px' }} onClick={() => setVue('nouveau')}>
                  + Nouveau
                </button>
              </div>
              {chantiers.length === 0 && (
                <div style={{ fontSize: '13px', color: '#888', padding: '10px 0' }}>Aucun chantier actif</div>
              )}
              {chantiers.map(c => (
                <div key={c.id} className="row-item" style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/employe/chantier/${c.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '8px',
                      background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                    }}>🏗️</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '13px' }}>{c.nom}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{c.adresse || 'Adresse non renseignée'}</div>
                    </div>
                  </div>
                  <span style={{ color: '#185FA5', fontSize: '18px' }}>›</span>
                </div>
              ))}
            </div>
          </>
        )}

        {vue === 'nouveau' && (
          <form className="card" onSubmit={creerChantier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label>Nom du chantier *</label>
              <input type="text" placeholder="Ex: Villa Müller" value={nomChantier}
                onChange={e => setNomChantier(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Adresse</label>
              <input type="text" placeholder="Rue, NPA, Ville" value={adresse}
                onChange={e => setAdresse(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Premier sous-dossier</label>
              <input type="text" placeholder="Ex: Cuisine, Salon, Tableau..." value={sousDossier}
                onChange={e => setSousDossier(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" style={{ borderRadius: '6px' }}>
              Créer le chantier
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
