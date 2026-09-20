import { HeroSection }        from '@/components/sections/hero'
import { BenefitsSection }    from '@/components/sections/benefits'
import { ProjectsSection }    from '@/components/sections/projects'
import { TestimonialsSection } from '@/components/sections/testimonials'
import { CtaSection }         from '@/components/sections/cta'
import { Header }             from '@/components/layout/header'
import { Footer }             from '@/components/layout/footer'

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <BenefitsSection />
        <ProjectsSection />
        <TestimonialsSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  )
}
