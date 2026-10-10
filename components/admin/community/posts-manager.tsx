'use client'
import { useCallback, useEffect, useState } from 'react'
import { uploadPresigned } from '@vercel/blob/client'
import { communityRequest, field, action } from './request'
type Post = { id: string; title: string; description: string; mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO'; thumbnailUrl: string | null; published: boolean }
const empty = { title: '', description: '', mediaUrl: '', mediaType: 'IMAGE' as 'IMAGE' | 'VIDEO', thumbnailUrl: '', published: false }
export function PostsManager() {
  const [posts, setPosts] = useState<Post[]>([]), [form, setForm] = useState(empty), [editing, setEditing] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const refresh = useCallback(async () => setPosts(await communityRequest<Post[]>('/api/admin/community/posts')), [])
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [refresh])
  async function media(file: File | undefined, thumbnail = false) {
    if (!file) return
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' }, extension = extensions[file.type], video = file.type.startsWith('video/')
    if (!extension || (thumbnail && video) || file.size > (video ? 50 : 10) * 1024 * 1024) { setError('Usa imagenes hasta 10 MB o MP4/WEBM hasta 50 MB'); return }
    setBusy(true); setError('')
    try {
      const blob = await uploadPresigned('community/' + crypto.randomUUID() + '.' + extension, file, { access: 'private', handleUploadUrl: '/api/admin/community/upload', multipart: video })
      setForm(prev => thumbnail ? { ...prev, thumbnailUrl: blob.url } : { ...prev, mediaUrl: blob.url, mediaType: video ? 'VIDEO' : 'IMAGE' })
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de upload') }
    finally { setBusy(false) }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await communityRequest('/api/admin/community/posts' + (editing ? '/' + editing : ''), editing ? 'PATCH' : 'POST', form); setForm(empty); setEditing(null); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  async function remove(id: string) {
    if (!window.confirm('Eliminar definitivamente la publicación, sus comentarios y sus archivos privados?')) return
    setBusy(true); setError('')
    try { await communityRequest('/api/admin/community/posts/' + id, 'DELETE'); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar') }
    finally { setBusy(false) }
  }
  return <section className="grid gap-10 xl:grid-cols-[1fr_1.2fr]"><form onSubmit={save} className="space-y-5">
    <h2 className="text-2xl font-black uppercase">{editing ? 'Editar archivo' : 'Nuevo archivo'}</h2>
    <label className="block text-xs text-white/50">Titulo<input required maxLength={160} className={field + ' mt-2'} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
    <label className="block text-xs text-white/50">Descripcion<textarea required maxLength={3000} rows={4} className={field + ' mt-2'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
    <label className="block border border-dashed border-white/25 p-5 text-sm">Imagen / video<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={e => media(e.target.files?.[0])} className="mt-3 block w-full text-xs" /><span className="mt-3 block text-xs text-white/40">{form.mediaUrl ? 'Archivo listo: ' + form.mediaType : 'Imagen: 10 MB / video: 50 MB'}</span><span className="mt-2 block text-xs text-white/40">Recomendado: 1200 × 1500 px (4:5) · WEBP o JPG · máximo 10 MB. Video: MP4 o WEBM · máximo 50 MB.</span></label>
    {form.mediaType === 'VIDEO' && <label className="block text-xs text-white/50">Miniatura opcional · recomendado 1200 × 1500 px (4:5), WEBP/JPG, máximo 10 MB<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => media(e.target.files?.[0], true)} className="mt-2 block" />{form.thumbnailUrl && <span className="mt-2 block">Miniatura lista</span>}</label>}
    <label className="flex gap-3 text-sm"><input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} />Publicado</label>
    <div className="flex flex-wrap gap-3"><button disabled={busy || !form.mediaUrl} className={action}>{busy ? 'Procesando...' : 'Guardar'}</button>{editing && <button type="button" onClick={() => { setForm(empty); setEditing(null) }} className={action}>Cancelar</button>}</div>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </form><div><p className="mb-5 text-xs uppercase tracking-widest text-white/40">Ultimos 100 archivos</p>
    {posts.map(post => <div key={post.id} className="border-t border-white/10 py-5"><p className="text-[10px] uppercase tracking-widest text-white/35">{post.mediaType} / {post.published ? 'Publicado' : 'Borrador'}</p><h3 className="my-3 text-xl font-bold">{post.title}</h3><div className="flex flex-wrap gap-4 text-xs"><button disabled={busy} onClick={() => { setEditing(post.id); setForm({ ...post, thumbnailUrl: post.thumbnailUrl || '' }) }}>Editar / publicar</button><button disabled={busy} onClick={() => remove(post.id)} className="text-red-400">Eliminar</button></div></div>)}
    {!posts.length && <p className="text-sm text-white/40">Aun no hay publicaciones.</p>}
  </div></section>
}
