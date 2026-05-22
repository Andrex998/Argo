import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Manifesto from '@/components/Manifesto';
import Services from '@/components/Services';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <Manifesto />
      <Services />
      {/* Future sections: Interactive3D, Showcase, FinalCTA */}
      <Footer />
    </>
  );
}
