'use client'

export default function CategoriesError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4">
    <p>No se pudieron cargar las categorías.</p>
    <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Volver a intentar</button>
  </div>
}
