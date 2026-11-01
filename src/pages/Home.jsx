import { useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import GlobeScene from '../components/company/GlobeScene.jsx';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const panel = 'home-panel relative z-2 py-10 max-sm:pt-5 group-data-[cinematic=true]:absolute group-data-[cinematic=true]:left-(--company-gutter) group-data-[cinematic=true]:p-0';
const eyebrow = 'mb-7 flex items-center gap-3 text-company-label font-semibold tracking-company-eyebrow text-company-muted uppercase max-sm:mb-6 max-sm:text-company-meta group-data-[compact=true]:mb-4';
const heading = 'm-0 font-display text-company-heading leading-company-heading font-medium tracking-company-heading max-sm:text-company-heading-mobile';
const storyHeading = `${heading} scroll-mt-28 font-normal! group-data-[compact=true]:text-company-heading-compact`;
const lead = 'mt-6 mb-6 max-w-company-panel text-base leading-normal text-company-muted max-sm:text-sm';
const button =
  'inline-flex min-h-13 items-center justify-between gap-7 rounded border border-company-accent bg-company-accent px-5.5 text-xs font-semibold text-company-button-ink transition-colors hover:bg-company-accent-hover motion-reduce:transition-none';
const textLink = 'inline-flex min-h-11 items-center gap-4.5 text-xs text-company-text hover:text-company-accent';
const note = 'mt-6 text-sm leading-company-note text-company-muted';
const nativePanel = 'border-t border-company-muted/15 py-16 group-data-[cinematic=true]:top-[8%] group-data-[cinematic=true]:w-[43%] group-data-[cinematic=true]:max-w-company-panel group-data-[cinematic=true]:border-0';

export default function Home() {
  const page = useRef(null);
  const sceneState = useRef({ progress: 0 });
  const scrollToChapter = useRef(null);
  const visitChapter = (event, chapter) => {
    if (!scrollToChapter.current) return;
    event.preventDefault();
    scrollToChapter.current(chapter);
  };
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add('(min-width: 1024px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)', () => {
        const root = page.current;
        root.dataset.cinematic = 'true';
        const stage = root.querySelector('.home-stage');
        const panels = root.querySelectorAll('.home-panel');
        const chapters = root.querySelectorAll('.home-chapter');
        const globe = root.querySelector('.home-globe');
        const lenis = new Lenis({ autoRaf: false, duration: 1.05 });
        lenis.on('scroll', ScrollTrigger.update);
        const tick = (seconds) => lenis.raf(seconds * 1000);
        gsap.ticker.add(tick);
        gsap.set(globe, { xPercent: -50, yPercent: -50, scale: 2.8 });
        gsap.set(root.querySelector('.home-chapters'), { autoAlpha: 0 });
        gsap.set([panels[1], panels[2]], { autoAlpha: 0, y: 36 });
        panels.forEach((item, index) => {
          item.inert = index !== 0;
        });
        const timeline = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: stage,
            start: 'top 104px',
            end: () => `+=${window.innerHeight * 2}`,
            pin: true,
            scrub: 0.7,
            snap: { snapTo: [0, 0.5, 1], duration: 0.3, delay: 0.15 },
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const chapter = Math.round(self.progress * 2);
              chapters.forEach((item, index) => {
                item.dataset.active = String(index === chapter);
                if (index === chapter) item.setAttribute('aria-current', 'step');
                else item.removeAttribute('aria-current');
              });
              // Only the current chapter belongs in the keyboard/accessibility flow.
              panels.forEach((item, index) => {
                item.inert = index !== chapter;
              });
            },
          },
        });
        timeline
          .to(panels[0], { autoAlpha: 0, y: -28, duration: 0.25 }, 0.1)
          .to(globe, { x: () => stage.clientWidth * 0.23, y: () => -stage.clientHeight * 0.85, scale: 0.95, duration: 0.7 }, 0.1)
          .to(panels[1], { autoAlpha: 1, y: 0, duration: 0.3 }, 0.6)
          .to(root.querySelector('.home-chapters'), { autoAlpha: 1, duration: 0.3 }, 0.6)
          .to(panels[1], { autoAlpha: 0, y: -28, duration: 0.25 }, 1.15)
          .to(panels[2], { autoAlpha: 1, y: 0, duration: 0.4 }, 1.6);
        scrollToChapter.current = (chapter) => {
          const { start, end } = timeline.scrollTrigger;
          lenis.scrollTo(start + ((end - start) * chapter) / 2);
        };
        let disposed = false;
        document.fonts?.ready.then(() => {
          if (!disposed) ScrollTrigger.refresh();
        });
        return () => {
          disposed = true;
          gsap.ticker.remove(tick);
          lenis.off('scroll', ScrollTrigger.update);
          lenis.destroy();
          scrollToChapter.current = null;
          panels.forEach((item) => {
            item.inert = false;
          });
          delete root.dataset.cinematic;
          sceneState.current.progress = 0;
        };
      });
      media.add('(min-width: 1024px) and (min-height: 600px) and (max-height: 800px) and (prefers-reduced-motion: no-preference)', () => {
        page.current.dataset.compact = 'true';
        return () => {
          delete page.current.dataset.compact;
        };
      });
      return () => media.revert();
    },
    { scope: page },
  );

  return (
    <div
      className="group group/home overflow-x-clip bg-company-bg font-sans text-company-text [&_a]:no-underline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-6 [&_a:focus-visible]:outline-company-accent [&_em]:text-company-accent [&_em]:not-italic"
      ref={page}
    >
      <section aria-label="A new perspective on aviation">
        <div className="home-stage relative isolate flex flex-col px-(--company-gutter) py-19 max-sm:px-6 max-sm:pt-11 max-sm:pb-4 group-data-[cinematic=true]/home:block group-data-[cinematic=true]/home:h-[calc(100svh-104px)] group-data-[cinematic=true]/home:py-0">
          <div className="home-globe relative order-1 z-0 aspect-square w-full group-data-[cinematic=true]/home:absolute group-data-[cinematic=true]/home:top-[135%] group-data-[cinematic=true]/home:left-1/2 group-data-[cinematic=true]/home:w-[52vw]">
            <div className="absolute inset-[12%] -rotate-18 rounded-full border border-company-accent/30 company-globe-poster shadow-company-globe">
              <i className="absolute inset-x-[28%] inset-y-[5%] rounded-full border border-company-accent/15" />
              <i className="absolute -inset-x-[5%] inset-y-[28%] rounded-full border border-company-accent/15" />
              <i className="absolute inset-[10%] rounded-full border border-company-accent/15" />
            </div>
            <GlobeScene sceneState={sceneState} />
          </div>
          <section
            className={`${panel} order-0 text-center group-data-[cinematic=true]:top-[26%] group-data-[cinematic=true]:right-(--company-gutter) group-data-[cinematic=true]:w-auto group-data-[cinematic=true]:max-w-none`}
            aria-labelledby="home-title"
          >
            <p className="mb-7 text-base tracking-[.15em] text-company-text/85">A different point of view</p>
            <h1 className="m-0 font-display text-[clamp(64px,7.2vw,112px)] leading-[.92] font-normal tracking-company-heading max-sm:text-company-hero-mobile" id="home-title">
              <span className="bg-linear-to-r from-company-text/35 via-company-text to-company-text/35 bg-clip-text text-transparent">See the world in</span>
              <br />
              flight.
            </h1>
            <p className="mx-auto mt-6 mb-6 max-w-3xl text-company-body leading-normal text-company-muted">Every aircraft has a place in a bigger story. Explore the skies with a little more perspective.</p>
            <a
              className="inline-flex min-h-13 items-center justify-center gap-5 rounded border border-company-text/30 px-6 text-sm hover:border-company-accent hover:text-company-accent"
              href="#home-flight-title"
              onClick={(event) => visitChapter(event, 1)}
            >
              Explore More <span aria-hidden="true">↓</span>
            </a>
          </section>
          <section className={`${panel} ${nativePanel} order-2`} aria-labelledby="home-flight-title">
            <p className="mb-7 text-base tracking-[.15em] text-company-text/85">Follow your curiosity</p>
            <h2 className={storyHeading} id="home-flight-title">
              A closer look.
              <br />A wider world.
            </h2>
            <p className={lead}>From commercial journeys to general aviation, discover a new way to understand the movement above us.</p>
            <p className={note}>Reported positions · coverage varies · no route data</p>
          </section>
          <section className={`${panel} ${nativePanel} order-3`} aria-labelledby="home-airport-title">
            <p className="mb-7 text-base tracking-[.15em] text-company-text/85">Follow your curiosity</p>
            <h2 className={storyHeading} id="home-airport-title">
              Every journey
              <br />
              begins
              <br />
              somewhere.
            </h2>
            <p className={lead}>Go beyond the flight. Get a sense of the places that bring the world together.</p>
            <p className={note}>Airport directory integration is planned.</p>
          </section>
          <nav className="home-chapters absolute top-[18%] right-(--company-gutter) z-2 hidden group-data-[cinematic=true]/home:block" aria-label="Hero chapters">
            <div className="flex flex-col items-center gap-6 border-l border-company-muted/40">
              {['Perspective', 'Flight', 'Places'].map((label, index) => (
                <a
                  key={label}
                  data-active={index === 0 ? 'true' : 'false'}
                  href={['#home-title', '#home-flight-title', '#home-airport-title'][index]}
                  onClick={(event) => visitChapter(event, index)}
                  aria-label={label}
                  className="home-chapter grid size-11 -translate-x-1/2 place-items-center text-xs text-company-muted opacity-45 transition-[opacity,color] duration-300 data-[active=true]:text-company-accent data-[active=true]:opacity-100 motion-reduce:transition-none"
                >
                  <span className="grid size-4 place-items-center rounded-full bg-company-bg">{index + 1}</span>
                </a>
              ))}
            </div>
          </nav>
        </div>
      </section>
      <section className="relative z-3 scroll-mt-27.5 border-t border-company-muted/15 bg-company-bg px-(--company-section-gutter) py-30 max-sm:px-6 max-sm:py-18" id="home-mission" aria-labelledby="home-mission-title">
        <p className={eyebrow}>03 / Our perspective</p>
        <div className="grid grid-cols-[1.2fr_1fr] gap-[10%] max-sm:grid-cols-1 max-sm:gap-8">
          <h2 className={heading} id="home-mission-title">
            The sky brings us
            <br />
            <em>closer.</em>
          </h2>
          <div className="max-w-company-mission">
            <p className="mt-0 mb-5.5 text-xl leading-normal">We believe a little perspective can turn an ordinary moment into a discovery.</p>
            <p className="mt-0 mb-5.5 text-sm leading-[1.9] text-company-muted">
              Flight Tracker is an invitation to look up, explore aviation, and connect with the world around you. Built for travelers, enthusiasts, and anyone curious about the skies.
            </p>
            <Link className={textLink} to="/about">
              More about us <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>
      <section className="relative overflow-hidden border-t border-company-muted/15 company-closing px-(--company-section-gutter) pt-25 pb-30 max-sm:px-6 max-sm:pt-18 max-sm:pb-22" aria-labelledby="home-closing-title">
        <p className={eyebrow}>Your next perspective</p>
        <h2 className={`${heading} mb-9!`} id="home-closing-title">
          The world is moving.
          <br />
          <em>Take a look.</em>
        </h2>
        <Link className={button} to="/map">
          Open Live Map{' '}
          <span className="text-company-arrow font-normal" aria-hidden="true">
            ↗
          </span>
        </Link>
        <span className="pointer-events-none absolute -top-40 -right-[200px] size-165 -rotate-35 scale-x-55 rounded-full border border-company-accent/15 max-sm:-right-[450px]" aria-hidden="true" />
      </section>
    </div>
  );
}
