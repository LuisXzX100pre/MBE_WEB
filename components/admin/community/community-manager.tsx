'use client'
import { useState } from 'react'
import { PostsManager } from './posts-manager'
import { CommentsManager } from './comments-manager'
import { WheelManager } from './wheel-manager'
import { InvitesManager } from './invites-manager'
import { EventsManager } from './events-manager'
export function CommunityManager() {
  const [tab, setTab] = useState('Contenido')
  return <div className="text-white"><div className="mb-10 flex flex-wrap gap-6 border-b border-white/15">{['Contenido', 'Comentarios', 'Ruleta', 'Eventos', 'Accesos'].map(t => <button key={t} onClick={() => setTab(t)} className={'pb-4 text-xs uppercase tracking-widest ' + (tab === t ? 'border-b border-white' : 'text-white/40')}>{t}</button>)}</div>{tab === 'Contenido' ? <PostsManager /> : tab === 'Comentarios' ? <CommentsManager /> : tab === 'Ruleta' ? <WheelManager /> : tab === 'Eventos' ? <EventsManager /> : <InvitesManager />}</div>
}
