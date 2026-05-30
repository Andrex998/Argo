import Header from '@/components/Header';
import Hero from '@/components/Hero';
import TrustedBy from '@/components/TrustedBy';
import About from '@/components/About';
import Manifesto from '@/components/Manifesto';
import Process from '@/components/Process';
import Services from '@/components/Services';
import Showcase from '@/components/Showcase';
import Testimonials from '@/components/Testimonials';
import FinalCTA from '@/components/FinalCTA';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <TrustedBy />
      <About />
      <Manifesto />
      <Process />
      <Services />
      <Showcase />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </>
  );
}
