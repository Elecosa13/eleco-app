'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import cataloguePrix from '@/lib/catalogue_prix.json'

type User = { id: string; prenom: string }
type SousDossier = { id: string; nom: string; chantier_id: string; chantiers?: { nom: string } }
type Article = { nom: string; categorie: string; unite: string; pu: number; pv: number; pa: number }
type Materiau = Article & { quantite: number }

const catalogue = cataloguePrix as Article[]
const categories = ['Favoris', ...Array.from(new Set(catalogue.map(a => a.categorie)))]
const FAVORIS_KEY = 'eleco_favoris'

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
  const [catalogueVue, setCatalogueVue] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [catFiltre, setCatFiltre] = useState('Favoris')
  const [favoris, setFavoris] = useState<string[]>([])
  const [envoi, setEnvoi] = useState(false)
  const [succes, setSucces] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('eleco_user')
    if (!stored) { router.push('/'); return }
    setUser(JSON.parse(stored))
    setFavoris(JSON.parse(localStorage.getItem(FAVORIS_KEY) || '[]'))
    supabase.from('sous_dossiers').select('*, chantiers(nom)').eq('id', sdId).single().then(({ data }) => {
      if (data) setSd(data as any)
    })
  }, [sdId])

  function toggleFavori(nom: string) {
    const newFavs = favoris.includes(nom) ? favoris.filter(f => f !== nom) : [...favoris, nom]
    setFavoris(newFavs)
    localStorage.setItem(FAVORIS_KEY, JSON.stringify(newFavs))
  }

  const articlesFiltres = (() => {
    let liste = catalogue
    if (catFiltre === 'Favoris') liste = catalogue.filter(a => favoris.includes(a.nom))
    else if (catFiltre) liste = catalogue.filter(a => a.categorie === catFiltre)
    if (recherche) liste = liste.filter(a => a.nom.toLowerCase().includes(recherche.toLowerCase()))
    return liste.slice(0, 60)
  })()

  function ajouterArticle(article: Article) {
    const existe = materiaux.find(m => m.nom === article.nom)
    if (existe) setMateriaux(materiaux.map(m => m.nom === article.nom ? { ...m, quantite: m.quantite + 1 } : m))
    else setMateriaux([...materiaux, { ...article, quantite: 1 }])
  }

  function modifierQte(nom: string, delta: number) {
    setMateriaux(materiaux.map(m => m.nom === nom ? { ...m, quantite: Math.max(0, m.quantite + delta) } : m).filter(m => m.quantite > 0))
  }

  function calcHeures() {
    const [h1, m1] = debut.split(':').map(Number)
    const [h2, m2] = fin.split(':').map(Number)
    return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
  }

  async function envoyerRapport(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !sd) return
    setEnvoi(true)
    const { data: rapport } = await supabase.from('rapports').insert({
      sous_dossier_id: sdId, employe_id: user.id,
      date_travail: date, heure_debut: debut, heure_fin: fin, remarques
    }).select().single()
    if (rapport && materiaux.length > 0) {
      await supabase.from('rapport_materiaux').insert(
        materiaux.map(m => ({
          rapport_id: rapport.id, ref_article: m.nom, designation: m.nom,
          unite: m.unite, quantite: m.quantite, prix_net: m.pu, prix_vente: m.pv, temps_pose: m.pa
        }))
      )
    }
    setEnvoi(false); setSucces(true)
    setTimeout(() => router.push(`/employe/chantier/${sd.chantier_id}`), 2000)
  }

  if (succes) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ fontSize: '48px' }}>✅</div>
      <div style={{ fontWeight: 600, fontSize: '16px' }}>Rapport envoyé !</div>
    </div>
  )

  if (catalogueVue) return (
    <div>
      <div className="top-bar">
        <div>
          <button onClick={() => setCatalogueVue(false)} style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: '13px', cursor: 'pointer', padding: 0 }}>← Retour</button>
          <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '4px' }}>Catalogue</div>
        </div>
        {materiaux.length > 0 && <span className="badge badge-blue">{materiaux.reduce((s, m) => s + m.quantite, 0)} articles</span>}
      </div>
      <div className="page-content">
        <input type="search" placeholder="Rechercher..." value={recherche} onChange={e => setRecherche(e.target.value)} />
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map(c => (
            <button key={c} onClick={() => setCatFiltre(c)} style={{
              padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              border: catFiltre === c ? 'none' : '1px solid #ddd',
              background: catFiltre === c ? '#185FA5' : 'white',
              color: catFiltre === c ? 'white' : '#333', whiteSpace: 'nowrap'
            }}>
              {c === 'Favoris' ? `⭐ Favoris (${favoris.length})` : c}
            </button>
          ))}
        </div>
        {catFiltre === 'Favoris' && favoris.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', fontSize: '13px', padding: '20px' }}>
            Appuie sur ⭐ pour ajouter des favoris
          </div>
        )}
        <div className="card" style={{ padding: 0 }}>
          {articlesFiltres.map((article, i) => {
            const qte = materiaux.find(m => m.nom === article.nom)?.quantite || 0
            const isFav = favoris.includes(article.nom)
            return (
              <div key={`${article.nom}-${i}`} style={{
                display: 'flex', alignItems: 'center', padding: '10px 14px', gap: '8px',
                borderBottom: i < articlesFiltres.length - 1 ? '1px solid #eee' : 'none'
              }}>
                <button onClick={() => toggleFavori(article.nom)} style={{
                  background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer',
                  opacity: isFav ? 1 : 0.25, padding: 0, flexShrink: 0
                }}>⭐</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{article.nom}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{article.categorie} · {article.unite}</div>
                </div>
                {qte === 0 ? (
                  <button onClick={() => ajouterArticle(article)} style={{
                    width: 28, height: 28, borderRadius: '50%', border: '1px solid #185FA5',
                    background: '#E6F1FB', color: '#185FA5', fontSize: '18px', cursor: 'pointer', flexShrink: 0
                  }}>+</button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => modifierQte(article.nom, -1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '14px' }}>−</button>
                    <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{qte}</span>
                    <button onClick={() => modifierQte(article.nom, 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #185FA5', background: '#185FA5', color: 'white', cursor: 'pointer', fontSize: '14px' }}>+</button>
                  </div>
                )}
              </div>
            )
          })}
          {articlesFiltres.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Aucun article trouvé</div>}
        </div>
        <button className="btn-primary" style={{ borderRadius: '6px' }} onClick={() => setCatalogueVue(false)}>
          ✓ Confirmer ({materiaux.reduce((s, m) => s + m.quantite, 0)} articles sélectionnés)
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
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Heures travaillées</div>
            <div className="form-group"><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
            <div className="grid2">
              <div className="form-group"><label>Début</label><input type="time" value={debut} onChange={e => setDebut(e.target.value)} required /></div>
              <div className="form-group"><label>Fin</label><input type="time" value={fin} onChange={e => setFin(e.target.value)} required /></div>
            </div>
            <div style={{ fontSize: '12px', color: '#185FA5', fontWeight: 500 }}>Durée : {calcHeures().toFixed(1)}h</div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Matériaux</span>
              <button type="button" className="btn-primary btn-sm" style={{ width: 'auto', borderRadius: '6px' }} onClick={() => setCatalogueVue(true)}>+ Ajouter</button>
            </div>
            {materiaux.length === 0 && <div style={{ fontSize: '13px', color: '#888' }}>Aucun article sélectionné</div>}
            {materiaux.map(m => (
              <div key={m.nom} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 500 }}>{m.nom}</div><div style={{ fontSize: '11px', color: '#888' }}>{m.unite}</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={() => modifierQte(m.nom, -1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '14px' }}>−</button>
                  <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center', fontSize: '13px' }}>{m.quantite}</span>
                  <button type="button" onClick={() => modifierQte(m.nom, 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #185FA5', background: '#185FA5', color: 'white', cursor: 'pointer', fontSize: '14px' }}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Remarques</div>
            <textarea placeholder="Observations..." value={remarques} onChange={e => setRemarques(e.target.value)} rows={3} />
          </div>
          <button type="submit" className="btn-primary" style={{ borderRadius: '6px' }} disabled={envoi}>
            {envoi ? 'Envoi...' : '✓ Envoyer le rapport'}
          </button>
        </div>
      </form>
    </div>
  )
}
