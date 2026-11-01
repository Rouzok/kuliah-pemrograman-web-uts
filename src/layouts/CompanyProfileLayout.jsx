import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const navigationLink =
  'relative flex min-h-11 items-center text-sm text-company-muted aria-[current=page]:text-company-text aria-[current=page]:after:absolute aria-[current=page]:after:right-1 aria-[current=page]:after:size-1 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-company-accent lg:aria-[current=page]:after:right-auto lg:aria-[current=page]:after:bottom-0 lg:aria-[current=page]:after:left-[calc(50%-2px)]';

export default function CompanyProfileLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  function closeOnEscape(event) {
    if (event.key === 'Escape' && menuOpen) {
      setMenuOpen(false);
      menuButton.current?.focus();
    }
  }

  return (
    <div
      className="min-h-screen bg-company-bg font-sans text-company-text [&_a]:no-underline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-5 [&_a:focus-visible]:outline-company-accent [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-5 [&_button:focus-visible]:outline-company-accent"
      onKeyDown={closeOnEscape}
    >
      <a className="fixed -top-25 left-5 z-100 bg-company-accent p-3 text-company-bg focus:top-3" href="#company-content">
        Skip to content
      </a>
      <header className="sticky top-0 z-50 flex h-20 items-center justify-between gap-3 bg-company-bg/15 backdrop-blur-lg shadow-lg px-5 lg:h-26 lg:gap-8 lg:px-20">
        <Link to="/" className="flex shrink-0 items-center gap-3 text-lg font-normal tracking-[-.5px] whitespace-nowrap lg:text-[22px]" aria-label="Flight Tracker home">
          <svg className="size-6 text-company-muted/80" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="16" cy="16" r="13" strokeDasharray="58 24" transform="rotate(-45 16 16)" />
            <circle cx="16" cy="16" r="8" strokeDasharray="34 16" transform="rotate(35 16 16)" />
            <path d="m16 16 8-8" />
            <circle cx="16" cy="16" r="2" />
          </svg>
          <span>Flight Tracker</span>
        </Link>
        <nav
          id="company-navigation"
          aria-label="Company profile"
          className={`${menuOpen ? 'flex' : 'hidden'} absolute inset-x-0 top-20 flex-col items-stretch gap-2 border-b border-white/12 bg-company-surface px-6 py-5 lg:static lg:ml-auto lg:flex lg:flex-row lg:items-center lg:gap-8 lg:border-0 lg:bg-transparent lg:p-0`}
        >
          <NavLink className={navigationLink} to="/about">
            About Us
          </NavLink>
          <NavLink className={navigationLink} to="/contact">
            Contact Us
          </NavLink>
          <span className="hidden h-4 w-px bg-company-muted lg:block" aria-hidden="true" />
          <button className="min-h-11 cursor-not-allowed text-left text-sm text-company-muted" disabled title="Login destination has not been configured">
            Login
          </button>
        </nav>
        <div className="flex items-center gap-2.5 text-xs">
          <Link
            to="/map"
            className="inline-flex min-h-11 items-center gap-3 rounded-md border border-company-muted/20 px-3 text-company-caption text-company-text hover:border-company-accent hover:text-company-accent lg:min-h-13 lg:gap-6 lg:px-6 lg:text-sm"
          >
            <span className="lg:hidden">Open tracker</span>
            <span className="hidden lg:inline">Open flight tracker</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <button ref={menuButton} className="min-h-11 min-w-11 text-xs lg:hidden" aria-expanded={menuOpen} aria-controls="company-navigation" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </header>
      <main id="company-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="mx-(--company-footer-gutter) flex flex-col flex-wrap items-start justify-between gap-5 border-t border-white/10 pt-12 pb-8 md:flex-row md:items-center md:gap-8">
        <div>
          <Link className="text-[21px] tracking-[-.8px]" to="/">
            FlightTracker
            <span className="text-company-accent" aria-hidden="true">
              {' '}
              ↗
            </span>
          </Link>
          <p className="mt-2.5 text-company-caption text-company-muted">A little curiosity. A whole new perspective.</p>
        </div>
        <nav className="flex gap-6 text-xs [&_a]:flex [&_a]:min-h-11 [&_a]:items-center" aria-label="Footer">
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact Us</Link>
        </nav>
        <small className="mt-2.5 text-company-caption text-company-muted">Company profile design preview · Illustrative visuals</small>
      </footer>
    </div>
  );
}
