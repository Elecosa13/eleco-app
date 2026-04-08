'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type User = { id: string; prenom: string; role: string; initiales: string }
type Rapport = {
  id: string; date_travail: string; heure_debut: string; heure_fin: string
  remarques: string; valide: boolean; created_at: string
  employe?: { prenom: string }
  sous_dossiers?: { nom: string; chantiers?: { nom: string } }
  rapport_materiaux?: { ref_article: string; designation: string; quantite: number; prix_net: number; unite: string }[]
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [rapports, setRapports] = useState<Rapport[]>([])
  const [onglet, setOnglet] = useState<'rapports' | 'chantiers'>('rapports')

  useEffect(() => {
    const stored = localStorage.getItem('eleco_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.role !== 'admin') { router.push('/'); return }
    setUser(u)
    chargerRapports()
  }, [])

  async function chargerRapports() {
    const { data } = await supabase
      .from('rapports')
      .select(`*, employe:employe_id(prenom), sous_dossiers(nom, chantiers(nom)), rapport_materiaux(*)`)
      .order('created_at', { ascending: false })
    if (data) setRapports(data as any)
  }

  async function validerRapport(id: string) {
    if (!user) return
    await supabase.from('rapports').update({ valide: true, valide_par: user.id, valide_le: new Date().toISOString() }).eq('id', id)
    chargerRapports()
  }

  async function refuserRapport(id: string) {
    await supabase.from('rapports').delete().eq('id', id)
    chargerRapports()
  }

  function calcHeures(debut: string, fin: string) {
    const [h1, m1] = debut.split(':').map(Number)
    const [h2, m2] = fin.split(':').map(Number)
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
    return `${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, '0')}`
  }

  function calcMontant(mats: Rapport['rapport_materiaux'], debut: string, fin: string) {
    const [h1, m1] = debut.split(':').map(Number)
    const [h2, m2] = fin.split(':').map(Number)
    const heures = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
    const matTotal = (mats || []).reduce((s, m) => s + m.quantite * m.prix_net, 0)
    const mainOeuvre = heures * 95 // CHF/h main d'oeuvre
    return (matTotal + mainOeuvre).toFixed(2)
  }

  const nonValides = rapports.filter(r => !r.valide)
  const valides = rapports.filter(r => r.valide)

  function deconnecter() {
    localStorage.removeItem('eleco_user')
    router.push('/')
  }

  if (!user) return null

  return (
    <div>
      <div className="top-bar">
        <div>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>
            Bonjour, {user.prenom.charAt(0).toUpperCase() + user.prenom.slice(1)}
          </div>
          <div style={{ fontSize: '11px', color: '#888' }}>Tableau de bord admin</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge badge-amber">Admin</span>
          <button className="avatar" style={{ background: '#FAEEDA', color: '#BA7517' }} onClick={deconnecter} title="Déconnexion">
            {user.initiales}
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e2e2', background: 'white' }}>
        {(['rapports', 'chantiers'] as const).map(o => (
          <button key={o} onClick={() => setOnglet(o)} style={{
            flex: 1, padding: '12px 8px', fontSize: '13px', fontWeight: 500,
            border: 'none', background: 'none', cursor: 'pointer',
            color: onglet === o ? '#185FA5' : '#888',
            borderBottom: onglet === o ? '2px solid #185FA5' : '2px solid transparent'
          }}>
            {o === 'rapports' ? `Rapports${nonValides.length > 0 ? ` (${nonValides.length})` : ''}` : 'Chantiers'}
          </button>
        ))}
      </div>

      <div className="page-content">
        {onglet === 'rapports' && (
          <>
            {/* À valider */}
            {nonValides.length > 0 && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>À valider</span>
                  <span className="badge badge-amber">{nonValides.length} nouveau{nonValides.length > 1 ? 'x' : ''}</span>
                </div>
                {nonValides.map(r => (
                  <div key={r.id} style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 500, fontSize: '13px' }}>
                      {(r.sous_dossiers as any)?.chantiers?.nom} · {(r.sous_dossiers as any)?.nom}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', margin: '3px 0 8px' }}>
                      {(r.employe as any)?.prenom} · {calcHeures(r.heure_debut, r.heure_fin)} · {new Date(r.date_travail).toLocaleDateString('fr-CH')}
                    </div>
                    {r.rapport_materiaux && r.rapport_materiaux.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
                        {r.rapport_materiaux.slice(0, 3).map(m => `${m.quantite}× ${m.designation.split(' ').slice(0,4).join(' ')}`).join(' · ')}
                        {r.rapport_materiaux.length > 3 && ` +${r.rapport_materiaux.length - 3} autres`}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#185FA5', marginBottom: '8px' }}>
                      Estimation : {calcMontant(r.rapport_materiaux, r.heure_debut, r.heure_fin)} CHF
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => refuserRapport(r.id)} className="btn-outline btn-sm" style={{ flex: 1, color: '#A32D2D', borderColor: '#f09595' }}>✕ Refuser</button>
                      <button onClick={() => validerRapport(r.id)} className="btn-primary btn-sm" style={{ flex: 1, borderRadius: '6px' }}>✓ Valider</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Historique validés */}
            {valides.length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
                  Historique validé
                </div>
                {valides.slice(0, 10).map(r => (
                  <div key={r.id} className="row-item">
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>
                        {(r.sous_dossiers as any)?.chantiers?.nom} · {(r.sous_dossiers as any)?.nom}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        {(r.employe as any)?.prenom} · {calcHeures(r.heure_debut, r.heure_fin)} · {new Date(r.date_travail).toLocaleDateString('fr-CH')}
                      </div>
                    </div>
                    <span className="badge badge-green">✓</span>
                  </div>
                ))}
              </div>
            )}

            {rapports.length === 0 && (
              <div style={{ textAlign: 'center', color: '#888', fontSize: '13px', padding: '40px 0' }}>
                Aucun rapport pour l'instant
              </div>
            )}
          </>
        )}

        {onglet === 'chantiers' && (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Tous les chantiers</div>
            <div style={{ fontSize: '13px', color: '#888' }}>
              Fonctionnalité en cours de développement
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
