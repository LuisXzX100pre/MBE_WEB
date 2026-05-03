import Link from 'next/link'
import { Instagram } from 'lucide-react'

function TikTokIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.228V2h-3.193v12.33a2.866 2.866 0 0 1-2.864 2.864 2.866 2.866 0 0 1-2.864-2.864 2.866 2.866 0 0 1 2.864-2.864c.298 0 .584.05.853.138V8.348a6.068 6.068 0 0 0-.853-.06A6.058 6.058 0 0 0 3.7 14.347a6.058 6.058 0 0 0 6.062 6.059 6.058 6.058 0 0 0 6.06-6.059V8.093a7.96 7.96 0 0 0 4.767 1.578V6.478c-.34 0-.674-.029-1-.092Z" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <h3 className="mb-4 text-2xl font-bold tracking-tighter">MBE</h3>

            <p className="max-w-xs text-sm text-muted-foreground">
              Streetwear exclusivo para quienes buscan destacar. Calidad premium,
              diseño único.
            </p>

            <div className="mt-4 flex gap-4">
              <a
                href="https://www.instagram.com/mbemighty?igsh=MTM4NTB3ZXdxZmlyeQ=="
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram de MBE"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Instagram className="w-5 h-5" />
              </a>

              <a
                href="https://www.tiktok.com/@mbemighty?_r=1&_t=ZS-95a3Ikf5hum"
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok de MBE"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <TikTokIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-medium">Tienda</h4>

            <ul className="space-y-2">
              <li>
                <Link
                  href="/productos"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Todos los productos
                </Link>
              </li>

              <li>
                <Link
                  href="/categorias"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Categorías
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            © 2026 MBE. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}