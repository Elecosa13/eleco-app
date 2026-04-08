'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [prenom, setPrenom] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErreur('')

    const { data, error } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('prenom', prenom.toLowerCase().trim())
      .eq('mot_de_passe', mdp)
      .eq('actif', true)
      .single()

    if (error || !data) {
      setErreur('Prénom ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    // Stocker la session dans localStorage
    localStorage.setItem('eleco_user', JSON.stringify({
      id: data.id,
      prenom: data.prenom,
      role: data.role,
      initiales: data.initiales
    }))

    if (data.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/employe')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      background: '#f5f5f5'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <img src="/logo.png" alt="Eleco SA" style={{ width: '110px', marginBottom: '10px' }} />
        <div style={{ fontSize: '18px', fontWeight: 600 }}>Eleco SA</div>
        <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>Électricité générale</div>
      </div>

      <form onSubmit={handleLogin} style={{
        background: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e2e2',
        padding: '24px',
        width: '100%',
        maxWidth: '310px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ fontSize: '15px', fontWeight: 600, textAlign: 'center' }}>Connexion</div>

        <div className="form-group">
          <label>Prénom</label>
          <input
            type="text"
            placeholder="Votre prénom"
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </div>

        <div className="form-group">
          <label>Mot de passe</label>
          <input
            type="password"
            placeholder="••••••••"
            value={mdp}
            onChange={e => setMdp(e.target.value)}
            required
          />
        </div>

        {erreur && (
          <div style={{
            background: '#FCEBEB',
            border: '1px solid #f09595',
            borderRadius: '6px',
            padding: '9px 12px',
            fontSize: '12px',
            color: '#A32D2D'
          }}>
            {erreur}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ borderRadius: '6px' }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
