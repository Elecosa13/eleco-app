'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import catalogueData from '@/lib/catalogue.json'

type User = { id: string; prenom: string }
type SousDossier = { id: string; nom: string; chantier_id: string }
type Materiau = { ref: string; nom: string; unite: string; categorie: string; quantite: number }
type Article = { ref: string; nom: string; unite: string; categorie: string; prix_net: number }

const catalogue = catalogueData as Article[]
const categories = Array.from(new Set(catalogue.map(a => a.categorie)))

export default function RapportPage() {
  const router = useRouter()
  const params = useParams()
  const sdId = params.id as string
  const [user, setUser] = useState<User | null>(null)
  const [sd, setSd] = useState<SousDossier | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [debut, setDebut] = useState('07:30')
  const [fin, setFin] = useState('17:00')
  const [remarques, setRemarques] = useState('')
  const [materiaux, setMateriaux] = useState<Materiau[]>([])
  const [catalogue_vue, setCatalogueVue] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [catFiltre, setCatFiltre] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [succes, setSucces] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('eleco_user')
    if (!stored) { router.push('/'); return }
    setUser(JSON.parse(stored))
    supabase.from('sous_dossiers').select('*, chantiers(nom)').eq('id', sdId).single().then(({ data }) => {
      if (data) setSd(data)
    })
  }, [sdId])

  const articlesFiltres = catalogue.filter(a => {
    const ok_cat = !catFiltre || a.categorie === catFiltre
    const ok_rech = !recherche || a.nom.toLowerCase().includes(recherche.toLowerCase()) || a.ref.includes(recherche)
    return ok_cat && ok_rech
  }).slice(0, 50)

  function ajouterArticle(article: Article) {
    const existe = materiaux.find(m => m.ref === article.ref)
    if (existe) {
      setMateriaux(materiaux.map(m => m.ref === article.ref ? { ...m, quantite: m.quantite + 1 } : m))
    } else {
      setMateriaux([...materiaux, { ref: article.ref, nom: article.nom, unite: article.unite, categorie: article.categorie, quantite: 1 }])
    }
  }

  function modifierQte(ref: string, delta: number) {
    setMateriaux(materiaux.map(m => m.ref === ref ? { ...m, quantite: Math.max(0, m.quantite + delta) } : m).filter(m => m.quantite > 0))
  }

  async function envoyerRapport(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !sd) return
    setEnvoi(true)

    const { data: rapport } = await supabase.from('rapports').insert({
      sous_dossier_id: sdId,
      employe_id: user.id,
      date_travail: date,
      heure_debut: debut,
      heure_fin: fin,
      remarques
    }).select().single()

    if (rapport && materiaux.length > 0) {
      const lignes = materiaux.map(m => {
        const art = catalogue.find(a => a.ref === m.ref)
        return {
          rapport_id: rapport.id,
          ref_article: m.ref,
          designation: m.nom,
          unite: m.unite,
          quantite: m.quantite,
          prix_net: art?.prix_net || 0
        }
      })
      await supabase.from('rapport_materiaux').insert(lignes)
    }

    setEnvoi(false)
    setSucces(true)
    setTimeout(() => router.push(`/employe/chantier/${sd.chantier_id}`), 2000)
  }

  if (succes) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ fontSize: '48px' }}>✅</div>
      <div style={{ fontWeight: 600, fontSize: '16px' }}>Rapport envoyé !</div>
      <div style={{ color: '#888', fontSize: '13px' }}>Le patron va le valider</div>
    </div>
  )

  if (catalogue_vue) return (
    <div>
      <div className="top-bar">
        <div>
          <button onClick={() => setCatalogueVue(false)} style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
            ← Retour
          </button>
          <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '4px' }}>Catalogue EM / Sonepar</div>
        </div>
        {materiaux.length > 0 && (
          <span className="badge badge-blue">{materiaux.reduce((s, m) => s + m.quantite, 0)} articles</span>
        )}
      </div>
      <div className="page-content">
        <input type="search" placeholder="Rechercher un article ou référence..." value={recherche} onChange={e => setRecherche(e.target.value)} />
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button onClick={() => setCatFiltre('')} className={catFiltre === '' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} style={{ borderRadius: '20px', whiteSpace: 'nowrap' }}>Tout</button>
          {categories.map(c => (
            <button key={c} onClick={() => setCatFiltre(c)} className={catFiltre === c ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} style={{ borderRadius: '20px', whiteSpace: 'nowrap' }}>{c}</button>
          ))}
        </div>
        <div className="card" style={{ padding: 0 }}>
          {articlesFiltres.map((article, i) => {
            const qte = materiaux.find(m => m.ref === article.ref)?.quantite || 0
            return (
              <div key={article.ref} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderBottom: i < articlesFiltres.length - 1 ? '1px solid #eee' : 'none'
              }}>
                <div style={{ flex: 1, marginRight: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{article.nom}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Réf. {article.ref} · {article.unite}</div>
                </div>
                {qte === 0 ? (
                  <button onClick={() => ajouterArticle(article)} style={{
                    width: 28, height: 28, borderRadius: '50%', border: '1px solid #185FA5',
                    background: '#E6F1FB', color: '#185FA5', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>+</button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => modifierQte(article.ref, -1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #ddd', background: 'white', fontSize: '14px' }}>−</button>
                    <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{qte}</span>
                    <button onClick={() => modifierQte(article.ref, 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #185FA5', background: '#185FA5', color: 'white', fontSize: '14px' }}>+</button>
                  </div>
                )}
              </div>
            )
          })}
          {articlesFiltres.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Aucun article trouvé</div>
          )}
        </div>
        <button className="btn-primary" style={{ borderRadius: '6px' }} onClick={() => setCatalogueVue(false)}>
          Confirmer ({materiaux.reduce((s, m) => s + m.quantite, 0)} articles sélectionnés)
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="top-bar">
        <div>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: '13px', cursor: 'pointer', padding: 0 }}>← Retour</button>
          <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '4px' }}>Nouveau rapport</div>
          {sd && <div style={{ fontSize: '11px', color: '#888' }}>{(sd as any).chantiers?.nom} › {sd.nom}</div>}
        </div>
      </div>

      <form onSubmit={envoyerRapport}>
        <div className="page-content">
          {/* Heures */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Heures travaillées</div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="grid2">
              <div className="form-group">
                <label>Début</label>
                <input type="time" value={debut} onChange={e => setDebut(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Fin</label>
                <input type="time" value={fin} onChange={e => setFin(e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Matériaux */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Matériaux utilisés</span>
              <button type="button" className="btn-primary btn-sm" style={{ width: 'auto', borderRadius: '6px' }} onClick={() => setCatalogueVue(true)}>
                + Ajouter
              </button>
            </div>
            {materiaux.length === 0 && (
              <div style={{ fontSize: '13px', color: '#888' }}>Aucun article sélectionné</div>
            )}
            {materiaux.map(m => (
              <div key={m.ref} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{m.nom}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Réf. {m.ref}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={() => modifierQte(m.ref, -1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #ddd', background: 'white', fontSize: '14px' }}>−</button>
                  <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{m.quantite}</span>
                  <button type="button" onClick={() => modifierQte(m.ref, 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #185FA5', background: '#185FA5', color: 'white', fontSize: '14px' }}>+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Remarques */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Remarques</div>
            <textarea placeholder="Observations, problèmes rencontrés..." value={remarques} onChange={e => setRemarques(e.target.value)} rows={3} />
          </div>

          <button type="submit" className="btn-primary" style={{ borderRadius: '6px' }} disabled={envoi}>
            {envoi ? 'Envoi en cours...' : '✓ Envoyer le rapport au patron'}
          </button>
        </div>
      </form>
    </div>
  )
}
