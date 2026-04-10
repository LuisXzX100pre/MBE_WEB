// components/store/community-section.tsx
'use client'

import { useState } from 'react'
import { X, Wrench } from 'lucide-react'

export function CommunitySection() {
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState('')

  const handleClick = () => {
    console.log("[v0] Suscribirse clicked, opening modal")
    setShowModal(true)
  }

  return (
    <>
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Unete a la comunidad MBE
          </h2>
          <p className="text-muted-foreground mb-8">
            Se el primero en conocer nuevos drops y ofertas exclusivas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu email"
              className="flex-1 px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleClick}
              className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Suscribirse
            </button>
          </div>
        </div>
      </section>

      {/* Modal de Mantenimiento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-card border border-border rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Wrench className="w-8 h-8 text-primary" />
              </div>

              <h3 className="text-2xl font-bold mb-3">
                Muy pronto
              </h3>

              <p className="text-muted-foreground mb-6">
                La comunidad MBE esta actualmente en mantenimiento. Estamos trabajando para traerte una experiencia increible.
              </p>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span>En mantenimiento</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
