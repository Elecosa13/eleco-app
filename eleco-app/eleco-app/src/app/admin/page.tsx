'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type User = { id: string; prenom: string; role: string; initiales: string }
type Materiau = { id: string; designation: string; unite: string; quantite: number; prix_net: number; prix_vente: number; temps_pose: number }
type Rapport = {
  id: string; date_travail: string; heure_debut: string; heure_fin: string
  remarques: string; valide: boolean; created_at: string
  employe: { prenom: string }
  sous_dossiers: { nom: string; chantiers: { nom: string } }
  rapport_materiaux: Materiau[]
}

const TAUX_HORAIRE = 115

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [rapports, setRapports] = useState<Rapport[]>([])
  const [rapportDetail, setRapportDetail] = useState<Rapport | null>(null)
  const [onglet, setOnglet] = useState<'rapports' | 'chantiers'>('rapports')
  const [emailClient, setEmailClient] = useState('')
  const [nomClient, setNomClient] = useState('')
  const [adresseClient, setAdresseClient] = useState('')
  const [numFacture, setNumFacture] = useState('')
  const [numDossier, setNumDossier] = useState('')
  const [description, setDescription] = useState('')
  const [showFacture, setShowFacture] = useState(false)
  const [envoyerEmail, setEnvoyerEmail] = useState(false)
  const [factureOk, setFactureOk] = useState(false)

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
    if (rapportDetail?.id === id) setRapportDetail(null)
  }

  async function refuserRapport(id: string) {
    if (!confirm('Refuser et supprimer ce rapport ?')) return
    await supabase.from('rapports').delete().eq('id', id)
    chargerRapports()
    if (rapportDetail?.id === id) setRapportDetail(null)
  }

  function calcHeures(debut: string, fin: string) {
    const [h1, m1] = debut.split(':').map(Number)
    const [h2, m2] = fin.split(':').map(Number)
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
    return diff / 60
  }

  function calcHeuresStr(debut: string, fin: string) {
    const h = calcHeures(debut, fin)
    return `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
  }

  function calcTotaux(r: Rapport) {
    const heures = calcHeures(r.heure_debut, r.heure_fin)
    // Temps pose total depuis les matériaux
    const tempsPose = (r.rapport_materiaux || []).reduce((s, m) => s + (m.temps_pose || 0) * m.quantite, 0)
    const totalHeures = heures + tempsPose
    const moMat = totalHeures * TAUX_HORAIRE
    const matTotal = (r.rapport_materiaux || []).reduce((s, m) => s + m.quantite * (m.prix_vente || 0), 0)
    const puTotal = (r.rapport_materiaux || []).reduce((s, m) => s + m.quantite * (m.prix_net || 0), 0)
    const sousTotal = matTotal + moMat
    const tva = sousTotal * 0.081
    const total = sousTotal + tva
    return { heures, tempsPose, totalHeures, moMat, matTotal, puTotal, sousTotal, tva, total }
  }

  async function genererFacture() {
    if (!rapportDetail) return
    const t = calcTotaux(rapportDetail)
    const date = new Date().toLocaleDateString('fr-CH')

    // Build Excel via API route (we'll generate client-side for now as a summary)
    // Mark as generating
    setFactureOk(false)

    // Create the data payload for the Excel generation
    const payload = {
      nomClient, adresseClient, numFacture, numDossier, description,
      date, emailClient,
      rapport: rapportDetail,
      totaux: t,
      tauxHoraire: TAUX_HORAIRE
    }

    // Store in supabase for tracking
    await supabase.from('factures').upsert({
      rapport_id: rapportDetail.id,
      num_facture: numFacture,
      num_dossier: numDossier,
      nom_client: nomClient,
      adresse_client: adresseClient,
      email_client: emailClient,
      description,
      montant_ht: t.sousTotal,
      tva: t.tva,
      montant_ttc: t.total,
      generee_le: new Date().toISOString(),
      generee_par: user?.id
    })

    setFactureOk(true)
    // Download trigger
    window.open(`/api/facture?id=${rapportDetail.id}&num=${numFacture}&dossier=${numDossier}&client=${encodeURIComponent(nomClient)}&adresse=${encodeURIComponent(adresseClient)}&desc=${encodeURIComponent(description)}&email=${encodeURIComponent(emailClient)}`, '_blank')
  }

  function deconnecter() {
    localStorage.removeItem('eleco_user')
    router.push('/')
  }

  const nonValides = rapports.filter(r => !r.valide)
  const valides = rapports.filter(r => r.valide)

  if (!user) return null

  // Vue détail rapport
  if (rapportDetail) {
    const t = calcTotaux(rapportDetail)
    return (
      <div>
        <div className="top-bar">
          <div>
            <button onClick={() => { setRapportDetail(null); setShowFacture(false) }} style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: '13px', cursor: 'pointer', padding: 0 }}>← Retour</button>
            <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '4px' }}>Détail du rapport</div>
            <div style={{ fontSize: '11px', color: '#888' }}>
              {(rapportDetail.sous_dossiers as any)?.chantiers?.nom} › {(rapportDetail.sous_dossiers as any)?.nom}
            </div>
          </div>
          {!rapportDetail.valide && (
            <span className="badge badge-amber">À valider</span>
          )}
        </div>

        <div className="page-content">
          {/* Infos générales */}
          <div className="card">
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: '11px', color: '#888' }}>Employé</div><div style={{ fontWeight: 500, fontSize: '14px' }}>{(rapportDetail.employe as any)?.prenom}</div></div>
              <div><div style={{ fontSize: '11px', color: '#888' }}>Date</div><div style={{ fontWeight: 500, fontSize: '14px' }}>{new Date(rapportDetail.date_travail).toLocaleDateString('fr-CH')}</div></div>
              <div><div style={{ fontSize: '11px', color: '#888' }}>Heures</div><div style={{ fontWeight: 500, fontSize: '14px' }}>{rapportDetail.heure_debut} → {rapportDetail.heure_fin} ({calcHeuresStr(rapportDetail.heure_debut, rapportDetail.heure_fin)})</div></div>
            </div>
            {rapportDetail.remarques && (
              <div style={{ marginTop: '10px', padding: '8px', background: '#f9f9f9', borderRadius: '6px', fontSize: '13px', color: '#555' }}>
                💬 {rapportDetail.remarques}
              </div>
            )}
          </div>

          {/* Matériaux */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '10px' }}>Matériaux utilisés</div>
            {(rapportDetail.rapport_materiaux || []).length === 0 && (
              <div style={{ fontSize: '13px', color: '#888' }}>Aucun matériau</div>
            )}
            {(rapportDetail.rapport_materiaux || []).map((m, i) => (
              <div key={m.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{m.designation}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{m.quantite} × {m.unite} · pose: {m.temps_pose}h/u</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{(m.quantite * (m.prix_net || 0)).toFixed(2)} CHF</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>PU: {m.prix_net} CHF</div>
                </div>
              </div>
            ))}
          </div>

          {/* Résumé financier */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Résumé financier</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#666' }}>Matériaux (PV)</span>
                <span style={{ fontWeight: 500 }}>{t.matTotal.toFixed(2)} CHF</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#666' }}>Main d'œuvre ({t.totalHeures.toFixed(1)}h × {TAUX_HORAIRE} CHF)</span>
                <span style={{ fontWeight: 500 }}>{t.moMat.toFixed(2)} CHF</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '6px', borderTop: '1px solid #eee' }}>
                <span style={{ color: '#666' }}>Total net HT</span>
                <span style={{ fontWeight: 600 }}>{t.sousTotal.toFixed(2)} CHF</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#666' }}>TVA 8.1%</span>
                <span>{t.tva.toFixed(2)} CHF</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, paddingTop: '8px', borderTop: '2px solid #185FA5', color: '#185FA5' }}>
                <span>TOTAL NET TTC</span>
                <span>{t.total.toFixed(2)} CHF</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {!rapportDetail.valide && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => refuserRapport(rapportDetail.id)} className="btn-outline" style={{ flex: 1, color: '#A32D2D', borderColor: '#f09595', borderRadius: '6px' }}>✕ Refuser</button>
              <button onClick={() => validerRapport(rapportDetail.id)} className="btn-primary" style={{ flex: 1, borderRadius: '6px' }}>✓ Valider</button>
            </div>
          )}

          {/* Génération facture */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
              📄 Générer la facture
            </div>
            {!showFacture ? (
              <button className="btn-primary" style={{ borderRadius: '6px' }} onClick={() => setShowFacture(true)}>
                Créer la facture Excel
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="grid2">
                  <div className="form-group">
                    <label>N° dossier</label>
                    <input type="text" placeholder="ex: 10802" value={numDossier} onChange={e => setNumDossier(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>N° facture</label>
                    <input type="text" placeholder="ex: 4812" value={numFacture} onChange={e => setNumFacture(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Nom du client</label>
                  <input type="text" placeholder="M. / Mme Dupont" value={nomClient} onChange={e => setNomClient(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Adresse</label>
                  <input type="text" placeholder="Rue, NPA Ville" value={adresseClient} onChange={e => setAdresseClient(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Email client (pour envoi)</label>
                  <input type="email" placeholder="client@exemple.ch" value={emailClient} onChange={e => setEmailClient(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Description des travaux</label>
                  <textarea placeholder="Installations électriques cuisine..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
                </div>
                <button className="btn-primary" style={{ borderRadius: '6px', background: '#3B6D11' }} onClick={genererFacture}>
                  📥 Télécharger Excel + Envoyer par email
                </button>
                {factureOk && (
                  <div style={{ background: '#EAF3DE', border: '1px solid #639922', borderRadius: '6px', padding: '10px', fontSize: '13px', color: '#3B6D11', textAlign: 'center' }}>
                    ✅ Facture générée et envoyée à {emailClient}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Vue liste rapports
  return (
    <div>
      <div className="top-bar">
        <div>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>Bonjour, {user.prenom.charAt(0).toUpperCase() + user.prenom.slice(1)}</div>
          <div style={{ fontSize: '11px', color: '#888' }}>Tableau de bord</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge badge-amber">Admin</span>
          <button className="avatar" style={{ background: '#FAEEDA', color: '#BA7517' }} onClick={deconnecter}>{user.initiales}</button>
        </div>
      </div>

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
            {nonValides.length > 0 && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>À valider</span>
                  <span className="badge badge-amber">{nonValides.length}</span>
                </div>
                {nonValides.map(r => {
                  const t = calcTotaux(r)
                  return (
                    <div key={r.id} style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #eee', cursor: 'pointer' }}
                      onClick={() => setRapportDetail(r)}>
                      <div style={{ fontWeight: 500, fontSize: '13px' }}>
                        {(r.sous_dossiers as any)?.chantiers?.nom} › {(r.sous_dossiers as any)?.nom}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', margin: '3px 0 4px' }}>
                        {(r.employe as any)?.prenom} · {calcHeuresStr(r.heure_debut, r.heure_fin)} · {new Date(r.date_travail).toLocaleDateString('fr-CH')}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#555' }}>
                          {(r.rapport_materiaux || []).length} article{(r.rapport_materiaux || []).length > 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#185FA5' }}>
                          {t.total.toFixed(0)} CHF TTC
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#185FA5', marginTop: '4px' }}>Voir détail →</div>
                    </div>
                  )
                })}
              </div>
            )}

            {valides.length > 0 && (
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Validés</div>
                {valides.slice(0, 15).map(r => {
                  const t = calcTotaux(r)
                  return (
                    <div key={r.id} className="row-item" style={{ cursor: 'pointer' }} onClick={() => setRapportDetail(r)}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{(r.sous_dossiers as any)?.chantiers?.nom} › {(r.sous_dossiers as any)?.nom}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{(r.employe as any)?.prenom} · {new Date(r.date_travail).toLocaleDateString('fr-CH')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.total.toFixed(0)} CHF</div>
                        <span className="badge badge-green" style={{ fontSize: '10px' }}>✓</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {rapports.length === 0 && (
              <div style={{ textAlign: 'center', color: '#888', fontSize: '13px', padding: '40px 0' }}>Aucun rapport</div>
            )}
          </>
        )}

        {onglet === 'chantiers' && (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Tous les chantiers</div>
            <div style={{ fontSize: '13px', color: '#888' }}>En cours de développement</div>
          </div>
        )}
      </div>
    </div>
  )
}
