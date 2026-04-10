// components/store/footer.tsx
import Link from 'next/link'
import { Instagram, Twitter } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold tracking-tighter mb-4">MBE</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Streetwear exclusivo para quienes buscan destacar. Calidad premium, diseno unico.
            </p>
            <div className="flex gap-4 mt-4">
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-medium mb-4">Tienda</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/productos"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Todos los productos
                </Link>
              </li>
              <li>
                <Link
                  href="/categorias"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Categorias
                </Link>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="font-medium mb-4">Info</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Envios
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Devoluciones
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contacto
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © {new Date().getFullYear()} MBE. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
