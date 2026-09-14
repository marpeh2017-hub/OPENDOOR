import { HeroSection } from '@/components/sections/hero'
import { BenefitsSection } from '@/components/sections/benefits'
import { CtaSection } from '@/components/sections/cta'
import { ContactSection } from '@/components/sections/contact'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

export default function HomePage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <HeroSection />
        <BenefitsSection />
        <CtaSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  )
}
