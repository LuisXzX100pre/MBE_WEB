// app/nosotros/page.tsx
import Image from 'next/image'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'

export default function NosotrosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-card to-background">
          <div className="max-w-4xl mx-auto text-center">
            <Image
              src="/logo.png"
              alt="MBE Logo"
              width={200}
              height={100}
              className="object-contain mx-auto h-20 md:h-28 w-auto mb-8"
            />
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Sobre MBE
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              &quot;MBE Es para todos, Pero no para cualquiera.&quot;
            </p>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Nuestra Historia</h2>
              <p className="text-muted-foreground leading-relaxed">
                MBE nacio de la pasion por el streetwear y la cultura urbana. Cada prenda que creamos 
                representa mas que solo moda - es una declaracion de identidad, una forma de expresion 
                que conecta a personas con mentalidades similares.
              </p>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Nuestra Vision</h2>
              <p className="text-muted-foreground leading-relaxed">
                Buscamos crear prendas que no solo se vean bien, sino que cuenten una historia. 
                Cada diseno es unico, pensado para quienes buscan destacar sin esforzarse demasiado. 
                La autenticidad es nuestro sello.
              </p>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Calidad y Compromiso</h2>
              <p className="text-muted-foreground leading-relaxed">
                Nos comprometemos con la calidad en cada detalle. Desde la seleccion de telas hasta 
                el acabado final, cada prenda pasa por un riguroso control de calidad para asegurar 
                que recibes lo mejor.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Nuestros Valores</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-bold mb-2">Autenticidad</h3>
                <p className="text-sm text-muted-foreground">
                  Ser genuino en todo lo que hacemos
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-bold mb-2">Calidad</h3>
                <p className="text-sm text-muted-foreground">
                  Sin compromisos en materiales y diseno
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-bold mb-2">Comunidad</h3>
                <p className="text-sm text-muted-foreground">
                  Construir conexiones reales
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
