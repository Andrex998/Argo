export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/5 px-6 py-16 md:px-12 md:py-24">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        {/* Editorial outro headline */}
        <div>
          <p className="font-display text-display-m text-bone leading-none">
            Let&apos;s build
            <br />
            <span className="text-voltage">presence.</span>
          </p>
        </div>

        {/* Contact + location — mono micro */}
        <div className="flex flex-col gap-2 font-mono text-micro uppercase tracking-widest text-pearl">
          <a
            href="mailto:hello@argostudio.com"
            className="transition-colors duration-fast ease-silk hover:text-voltage"
          >
            hello@argostudio.com
          </a>
          <span className="text-smoke">Based in Italy — working worldwide</span>
        </div>
      </div>

      {/* Bottom strip — copyright + version */}
      <div className="mt-20 flex items-center justify-between font-mono text-micro uppercase tracking-widest text-smoke">
        <span>© {currentYear} ARGO Studio</span>
        <span>v0.1</span>
      </div>
    </footer>
  );
}
