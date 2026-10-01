import Header from '@/components/Header'
import Hero from '@/components/Hero'
import ConnectedClouds from '@/components/ConnectedClouds'
import CostBreakdown from '@/components/CostBreakdown'
import ResourceInventory from '@/components/ResourceInventory'
import FeaturesBento from '@/components/FeaturesBento'
import SpendAnomaly from '@/components/SpendAnomaly'
import SavingsQueue from '@/components/SavingsQueue'
import FinalCta from '@/components/FinalCta'
import FooterExpanded from '@/components/FooterExpanded'
import SiteFooter from '@/components/SiteFooter'

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
      <Header />
      <main className="min-h-screen w-full bg-surface pt-16">
        <div className="flex w-full flex-col">
          <Hero />
          <ConnectedClouds />
          <CostBreakdown />
          <ResourceInventory />
          <FeaturesBento />
          <SpendAnomaly />
          <SavingsQueue />
          <FinalCta />
          <FooterExpanded />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
