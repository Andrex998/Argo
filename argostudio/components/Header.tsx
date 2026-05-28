export default function Header() {
  return (
    <header className="fixed top-0 left-0 z-50 w-full px-6 py-6 md:px-12">
      <nav className="flex items-center justify-between">
        {/* Logo — wordmark, display weight */}
        <a
          href="/"
          className="font-display text-heading-s text-bone tracking-tight"
          aria-label="ARGO Studio — homepage"
        >
          ARGO
        </a>

        {/* Center nav — desktop only, mono micro */}
        <ul className="hidden items-center gap-10 font-mono text-micro uppercase tracking-widest text-pearl md:flex">
          <li>
            <a
              href="#manifesto"
              className="transition-colors duration-fast ease-silk hover:text-voltage"
            >
              Manifesto
            </a>
          </li>
          <li>
            <a
              href="#services"
              className="transition-colors duration-fast ease-silk hover:text-voltage"
            >
              Services
            </a>
          </li>
          <li>
            <a
              href="#contact"
              className="transition-colors duration-fast ease-silk hover:text-voltage"
            >
              Contact
            </a>
          </li>
        </ul>

        {/* Right CTA — glass pill */}
        <a
          href="#contact"
          className="rounded-full glass-subtle px-5 py-2.5 font-mono text-micro uppercase tracking-widest text-bone transition-all duration-fast ease-silk hover:shadow-glow-subtle"
        >
          Get in touch
        </a>
      </nav>
    </header>
  );
}
