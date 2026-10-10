'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { uploadPresigned } from '@vercel/blob/client'
import { communityRequest, field, action } from './request'
type Post = { id: string; title: string; description: string; mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO'; thumbnailUrl: string | null; published: boolean; media?: { id: string; url: string; order: number }[] }
const empty = { title: '', description: '', mediaUrl: '', mediaType: 'IMAGE' as 'IMAGE' | 'VIDEO', thumbnailUrl: '', published: false, mediaUrls: [] as string[] }
export function PostsManager() {
  const [posts, setPosts] = useState<Post[]>([]), [form, setForm] = useState(empty), [editing, setEditing] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const localPreviews = useRef<string[]>([])
  const refresh = useCallback(async () => setPosts(await communityRequest<Post[]>('/api/admin/community/posts')), [])
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [refresh])
  useEffect(() => () => { localPreviews.current.forEach(url => URL.revokeObjectURL(url)) }, [])
  async function media(files: File[], thumbnail = false) {
    if (!files.length || busy) return
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' }
    const images = thumbnail || form.mediaType === 'IMAGE'
    if ((images && !thumbnail && files.length + form.mediaUrls.length > 5) || ((!images || thumbnail) && files.length !== 1)) { setError(images ? 'Maximo 5 imagenes por publicacion' : 'Selecciona un solo video'); return }
    if (files.some(file => !extensions[file.type] || file.type.startsWith('image/') !== images || file.size > (images ? 10 : 50) * 1024 * 1024)) { setError('Usa JPEG/PNG/WEBP/GIF hasta 10 MB por imagen o MP4/WEBM hasta 50 MB; no mezcles imagenes y video'); return }
    setBusy(true); setError('')
    try {
      for (const file of files) {
        const blob = await uploadPresigned('community/' + crypto.randomUUID() + '.' + extensions[file.type], file, { access: 'private', handleUploadUrl: '/api/admin/community/upload', multipart: !images })
        if (images) { const preview = URL.createObjectURL(file); localPreviews.current.push(preview); setPreviews(prev => ({ ...prev, [blob.url]: preview })) }
        setForm(prev => thumbnail ? { ...prev, thumbnailUrl: blob.url } : images
          ? { ...prev, mediaUrl: prev.mediaUrls[0] || blob.url, mediaUrls: [...prev.mediaUrls, blob.url] }
          : { ...prev, mediaUrl: blob.url })
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de upload') }
    finally { setBusy(false) }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (form.mediaType === 'IMAGE' && !form.mediaUrls.length) { setError('Conserva al menos una imagen'); return }
    setBusy(true); setError('')
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
  function edit(post: Post) {
    const mediaUrls = post.mediaType === 'IMAGE' ? (post.media?.length ? post.media.map(m => m.url) : [post.mediaUrl]) : []
    setEditing(post.id); setError(''); setForm({ title: post.title, description: post.description, published: post.published, mediaType: post.mediaType, mediaUrl: post.mediaUrl, thumbnailUrl: post.thumbnailUrl || '', mediaUrls })
  }
  function removeImage(url: string) {
    if (form.mediaUrls.length <= 1) { setError('Conserva al menos una imagen'); return }
    setForm(prev => { const mediaUrls = prev.mediaUrls.filter(value => value !== url); return { ...prev, mediaUrls, mediaUrl: mediaUrls[0] } })
  }
  function previewUrl(url: string) {
    if (previews[url]) return previews[url]
    const post = posts.find(p => p.id === editing), image = post?.media?.find(m => m.url === url)
    return post ? '/api/community/media/' + post.id + (image ? '?mediaId=' + encodeURIComponent(image.id) : '') : undefined
  }
  return <section className="grid gap-10 xl:grid-cols-[1fr_1.2fr]"><form onSubmit={save} className="space-y-5">
    <h2 className="text-2xl font-black uppercase">{editing ? 'Editar archivo' : 'Nuevo archivo'}</h2>
    <label className="block text-xs text-white/50">Titulo<input required maxLength={160} className={field + ' mt-2'} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
    <label className="block text-xs text-white/50">Descripcion<textarea required maxLength={3000} rows={4} className={field + ' mt-2'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
    <label className="block text-xs text-white/50">Tipo de contenido<select disabled={busy} className={field + ' mt-2'} value={form.mediaType} onChange={e => setForm(prev => ({ ...prev, mediaType: e.target.value as 'IMAGE' | 'VIDEO', mediaUrl: '', mediaUrls: [], thumbnailUrl: '' }))}><option value="IMAGE">Imagenes</option><option value="VIDEO">Video</option></select></label>
    <label className="block border border-dashed border-white/25 p-5 text-sm">{form.mediaType === 'IMAGE' ? 'Agregar imagenes' : 'Video'}<input disabled={busy || (form.mediaType === 'IMAGE' && form.mediaUrls.length >= 5)} type="file" multiple={form.mediaType === 'IMAGE'} accept={form.mediaType === 'IMAGE' ? 'image/jpeg,image/png,image/webp,image/gif' : 'video/mp4,video/webm'} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void media(files) }} className="mt-3 block w-full text-xs" /><span className="mt-3 block text-xs text-white/40">{form.mediaType === 'IMAGE' ? `${form.mediaUrls.length} / 5 imágenes seleccionadas` : form.mediaUrl ? 'Video listo' : 'MP4 o WEBM · máximo 50 MB'}</span><span className="mt-2 block text-xs text-white/40">{form.mediaType === 'IMAGE' ? 'Recomendado: 1200 × 1500 px (4:5) · WEBP o JPG · máximo 10 MB por imagen · máximo 5 imágenes' : 'MP4 o WEBM · máximo 50 MB'}</span></label>
    {form.mediaType === 'IMAGE' && <div className="flex flex-wrap gap-3">{form.mediaUrls.map((url, index) => { const preview = previewUrl(url); return <div key={url} className="w-24 space-y-2">{preview && <Image src={preview} alt={`Imagen ${index + 1}`} width={96} height={120} unoptimized className="aspect-[4/5] w-full rounded object-contain" />}<button type="button" disabled={busy || form.mediaUrls.length <= 1} onClick={() => removeImage(url)} className="text-xs text-red-300 disabled:opacity-40" aria-label={`Eliminar imagen ${index + 1}`}>Eliminar {index + 1}</button></div> })}{editing && <p className="w-full text-xs text-white/40">Las eliminaciones se aplican al guardar.</p>}</div>}
    {form.mediaType === 'VIDEO' && <label className="block text-xs text-white/50">Miniatura opcional · recomendado 1200 × 1500 px (4:5), WEBP/JPG, máximo 10 MB<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void media(files, true) }} className="mt-2 block" />{form.thumbnailUrl && <span className="mt-2 block">Miniatura lista</span>}</label>}
    <label className="flex gap-3 text-sm"><input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} />Publicado</label>
    <div className="flex flex-wrap gap-3"><button disabled={busy || !form.mediaUrl} className={action}>{busy ? 'Procesando...' : 'Guardar'}</button>{editing && <button type="button" onClick={() => { setForm(empty); setEditing(null) }} className={action}>Cancelar</button>}</div>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </form><div><p className="mb-5 text-xs uppercase tracking-widest text-white/40">Ultimos 100 archivos</p>
    {posts.map(post => <div key={post.id} className="border-t border-white/10 py-5"><p className="text-[10px] uppercase tracking-widest text-white/35">{post.mediaType} / {post.published ? 'Publicado' : 'Borrador'}</p><h3 className="my-3 text-xl font-bold">{post.title}</h3><div className="flex flex-wrap gap-4 text-xs"><button disabled={busy} onClick={() => edit(post)}>Editar / publicar</button><button disabled={busy} onClick={() => remove(post.id)} className="text-red-400">Eliminar</button></div></div>)}
    {!posts.length && <p className="text-sm text-white/40">Aun no hay publicaciones.</p>}
  </div></section>
}
