import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { NarrativeSection } from "@/components/landing/NarrativeSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { DutchAuctionSection } from "@/components/landing/DutchAuctionSection";
import { AudienceSplit } from "@/components/landing/AudienceSplit";
import { PrivacyStandards } from "@/components/landing/PrivacyStandards";
import { TechSection } from "@/components/landing/TechSection";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export function Landing() {
  return (
    <div className="font-sans bg-slate-50 text-slate-900 min-h-screen">
      <Navbar />
      <HeroSection />
      <NarrativeSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DutchAuctionSection />
      <AudienceSplit />
      <PrivacyStandards />
      <TechSection />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
