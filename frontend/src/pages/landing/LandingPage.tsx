import { ArrowDown, ArrowRight, Hand, Moon, Plus, Scale, Sun, UserCheck } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth'
import { useTheme } from '@/providers/theme'
import { FeatureSlider } from './FeatureSlider'
import { HeroBoard } from './HeroBoard'
import { LiveDemo } from './LiveDemo'
import { HandNote, Parallax, Reveal, SmoothScroll, useSmoothScroll } from './motion'
import { TaskAnatomy } from './TaskAnatomy'

export default function LandingPage() {
  return (
    <SmoothScroll>
      <div className="relative overflow-x-clip">
        <Nav />
        <Hero />
        <Ticker />
        <Problem />
        <Section id="questions">
          <TaskAnatomy />
        </Section>
        <Demo />
        <Principles />
        <Section id="features">
          <FeatureSlider />
        </Section>
        <HowItWorks />
        <Faq />
        <FinalCta />
        <Footer />
      </div>
    </SmoothScroll>
  )
}

function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32', className)}>
      {children}
    </section>
  )
}

const display = 'font-display tracking-tight'

/* ======================================================================= Nav */

function Nav() {
  const { session } = useAuth()
  const { scrollTo, scrolled } = useSmoothScroll()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'))

  const links: [string, string][] = [
    ['How it works', '#how'],
    ['Try it', '#demo'],
    ['Features', '#features'],
    ['FAQ', '#faq'],
  ]

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled ? 'py-2' : 'py-4')}>
      <div
        className={cn(
          'mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-2 transition-all duration-300 sm:px-5',
          scrolled ? 'mx-3 border border-line bg-surface/80 shadow-sm backdrop-blur-md sm:mx-auto' : 'border border-transparent',
        )}
      >
        <a href="#top" onClick={(e) => {
            e.preventDefault()
            scrollTo('#top')
          }} className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" className="size-7" />
          <span className="text-lg">Coop</span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              onClick={(e) => {
                e.preventDefault()
                scrollTo(href)
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          {session ? (
            <Link to="/dashboard" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-sm transition hover:brightness-110">
              Open Coop
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg sm:block">
                Sign in
              </Link>
              <Link to="/signup" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-sm transition hover:brightness-110 active:scale-95">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/* ======================================================================= Hero */

function Hero() {
  const { scrollTo } = useSmoothScroll()
  const { session } = useAuth()
  return (
    <section id="top" className="relative pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* dotted paper + soft glow */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
        style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      />
      <div aria-hidden className="absolute top-20 left-1/2 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <Reveal variant="pop" tilt={-2}>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium shadow-sm">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              For teams who wait on each other
            </span>
          </Reveal>

          <Reveal delay={120}>
            <h1 className={cn(display, 'mt-6 text-[3.2rem] leading-[0.95] sm:text-7xl lg:text-[4.9rem]')}>
              Know what's{' '}
              <span className="relative inline-block italic">
                stuck
                <svg className="scribble absolute -bottom-2 left-0 h-4 w-full text-accent" viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden>
                  <path d="M3 11 C 40 3, 80 14, 118 7 S 180 4, 197 10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
              <br />
              before the <span className="whitespace-nowrap">stand-up.</span>
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted">
              Coop is a shared board for people whose work depends on each other. Everyone updates their own piece. Coop keeps track of what moved, what's
              waiting and who's blocked, and tells the team while there's still time to fix it.
            </p>
          </Reveal>

          <Reveal delay={360} className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to={session ? '/dashboard' : '/signup'}
              className="group inline-flex items-center gap-2 rounded-2xl bg-accent px-6 py-3.5 font-medium text-accent-fg shadow-[0_10px_30px_-10px_var(--accent)] transition hover:brightness-110 active:scale-[0.98]"
            >
              {session ? 'Go to your dashboard' : 'Start your workspace'}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <button
              onClick={() => scrollTo('#demo')}
              className="group inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-6 py-3.5 font-medium transition hover:border-accent/40"
            >
              See it work <ArrowDown className="size-4 transition-transform group-hover:translate-y-0.5" />
            </button>
          </Reveal>

          <Reveal delay={480}>
            <p className="mt-5 text-sm text-muted">Your first group takes about a minute to set up.</p>
          </Reveal>
        </div>

        <div className="relative">
          <Parallax speed={0.05}>
            <Reveal variant="stop" delay={200} tilt={1}>
              <HeroBoard />
            </Reveal>
          </Parallax>

          {/* stickers that drift at their own pace while scrolling */}
          <Parallax speed={-0.12} className="absolute -top-10 -left-6 hidden sm:block">
            <Reveal variant="pop" delay={900} tilt={-8}>
              <div className="boil rounded-sm bg-amber-200 px-3 py-2.5 text-amber-950 shadow-md" style={{ '--r': '-8deg' } as CSSProperties}>
                <p className="font-hand text-lg leading-none">Thu stand-up:</p>
                <p className="font-hand text-lg leading-none">10 min, tops</p>
              </div>
            </Reveal>
          </Parallax>
          <Parallax speed={-0.2} className="absolute -right-4 -bottom-12 hidden md:block">
            <Reveal variant="pop" delay={1100} tilt={6}>
              <div className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium shadow-lg">
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500" />
                REL-3 is ready to start
              </div>
            </Reveal>
          </Parallax>
        </div>
      </div>
    </section>
  )
}

/* ======================================================================= Ticker */

const TICKS = [
  'Meera moved QA sign-off to Done',
  'Ravi flagged a blocker: Q3 figures from finance',
  'Deployment schedule is ready to start',
  'Kavya accepted the consolidated report',
  "Asha picked up 'Pricing page copy'",
  'Vendor access unblocked by Sam',
  "Dev's API work is at 80%",
  'Go-live is waiting on 1 approval',
]

function Ticker() {
  return (
    <div className="border-y border-line bg-surface/70 py-4" aria-hidden>
      <div className="ticker flex w-max gap-10 whitespace-nowrap">
        {[...TICKS, ...TICKS].map((t, i) => (
          <span key={i} className="flex items-center gap-3 text-sm text-muted">
            <span className={cn('size-1.5 rounded-full', i % 3 === 1 ? 'bg-rose-400' : i % 3 === 2 ? 'bg-emerald-400' : 'bg-accent')} />
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ======================================================================= Problem */

const NOTES = [
  { text: "Ravi has been waiting on finance since Tuesday. Nobody else knows.", tilt: -3, color: 'bg-amber-100 dark:bg-amber-950/60' },
  { text: "Asha finished early on Wednesday. She didn't say, so the next step didn't start.", tilt: 2, color: 'bg-sky-100 dark:bg-sky-950/60' },
  { text: "Thursday's stand-up finds out what was true on Monday.", tilt: -1.5, color: 'bg-rose-100 dark:bg-rose-950/60' },
]

function Problem() {
  return (
    <Section>
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <h2 className={cn(display, 'text-4xl leading-[1.05] sm:text-6xl')}>
            Projects rarely fail loudly.
            <br />
            <span className="italic text-muted">They slip a day at a time.</span>
          </h2>
        </Reveal>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {NOTES.map((n, i) => (
          <Reveal key={i} variant="stop" delay={i * 160} tilt={n.tilt}>
            <div className={cn('relative rounded-md p-6 pt-8 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.25)]', n.color)}>
              <span aria-hidden className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-2 rounded-sm bg-white/60 shadow-sm dark:bg-white/10" />
              <p className="font-hand text-2xl leading-snug text-fg">{n.text}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={200} className="mx-auto mt-16 max-w-2xl text-center">
        <p className="text-lg leading-relaxed text-muted">
          Nobody here is slacking. The information just has nowhere to go, so it sits in someone's head or scrolls away in a chat.{' '}
          <span className="font-medium text-fg">Coop is the place it goes.</span>
        </p>
      </Reveal>
    </Section>
  )
}

/* ======================================================================= Demo */

function Demo() {
  return (
    <section id="demo" className="relative py-24 sm:py-32">
      <div aria-hidden className="absolute inset-0 -z-10 bg-surface-2/50" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <Reveal>
              <p className="text-sm font-semibold text-accent">Try it</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className={cn(display, 'mt-2 text-4xl leading-[1.05] sm:text-6xl')}>
                The real flow, <span className="italic text-muted">minus the <span className="whitespace-nowrap">sign-up.</span></span>
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                Four people, one release, one message in the team chat. Send it and watch what Coop does with it. Also watch what it doesn't do without
                asking.
              </p>
            </Reveal>
          </div>
          <Reveal variant="pop" delay={500} tilt={-4} className="hidden lg:block">
            <HandNote className="text-2xl">go on, hit send ↘</HandNote>
          </Reveal>
        </div>

        <Reveal variant="rise" delay={120}>
          <LiveDemo />
        </Reveal>
      </div>
    </section>
  )
}

/* ======================================================================= Principles */

const PRINCIPLES = [
  { icon: <Hand className="size-5" />, title: 'It drafts. A person decides.', body: 'Coop reads the chat and drafts updates. Nothing on the board changes until someone says yes.' },
  { icon: <UserCheck className="size-5" />, title: "It doesn't keep score.", body: "It reports what's done and what's in the way. It won't guess who's slow, or why, and it never assigns blame." },
  { icon: <Scale className="size-5" />, title: 'One set of rules.', body: 'A button, a chat message or an AI suggestion all go through the same checks before anything is saved.' },
]

function Principles() {
  return (
    <Section className="pb-8 sm:pb-12">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <h2 className={cn(display, 'text-4xl leading-[1.05] sm:text-5xl')}>
            AI that knows <span className="italic text-muted">its place.</span>
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-muted">
            We like what AI can do with a messy thread. We don't like software that quietly rewrites the plan. So Coop's AI works like a sharp assistant
            with no authority.
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 120}>
              <div className="group flex gap-4 rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent transition-transform duration-300 group-hover:-rotate-6">
                  {p.icon}
                </span>
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  )
}

/* ======================================================================= How it works */

const STEPS = [
  {
    title: 'Write down the goal',
    body: "One or two lines is plenty: \"Launch the new pricing page by the 15th.\" Attach a brief if you have one. Only group admins add context, so it stays on topic.",
    tilt: -4,
  },
  {
    title: 'Coop splits it up by role',
    body: 'It reads the goal and who does what, then proposes subtasks and an owner for each. You keep, edit or bin every one of them.',
    tag: 'Rolling out soon',
    tilt: 3,
  },
  {
    title: 'Everyone updates their own piece',
    body: 'People move their own cards and flag what is stuck. The manager gets a short, plain summary instead of a round of "any updates?" messages.',
    tilt: -2,
  },
]

function HowItWorks() {
  return (
    <Section id="how">
      <div className="max-w-2xl">
        <Reveal>
          <p className="text-sm font-semibold text-accent">How it works</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className={cn(display, 'mt-2 text-4xl leading-[1.05] sm:text-6xl')}>
            Three steps. <span className="italic text-muted">The third one repeats.</span>
          </h2>
        </Reveal>
      </div>

      <div className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
        <svg aria-hidden className="absolute top-8 right-[16%] left-[16%] hidden h-6 text-line md:block" viewBox="0 0 600 24" preserveAspectRatio="none">
          <path d="M0 12 C 100 0, 200 24, 300 12 S 500 0, 600 12" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 8" />
        </svg>
        {STEPS.map((s, i) => (
          <Reveal key={s.title} variant="stop" delay={i * 180} className="relative">
            <span
              className="boil relative z-10 flex size-16 items-center justify-center rounded-2xl bg-accent text-3xl text-accent-fg shadow-[0_10px_25px_-8px_var(--accent)]"
              style={{ '--r': `${s.tilt}deg` } as CSSProperties}
            >
              <span className={display}>{i + 1}</span>
            </span>
            <h3 className="mt-6 flex flex-wrap items-center gap-2 text-xl font-semibold">
              {s.title}
              {s.tag && <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-[10px] font-medium text-muted">{s.tag}</span>}
            </h3>
            <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ======================================================================= FAQ */

const FAQS = [
  {
    q: 'Is this another tool my team has to babysit?',
    a: 'We hope not. Each person only touches their own tasks, usually a couple of clicks a day. The manager summary is built from those clicks, so nobody writes status reports.',
  },
  {
    q: 'Will the AI blame people when things slip?',
    a: "No, and that's deliberate. It can say a task is blocked and what's blocking it. It won't say someone is slow, and it won't guess at reasons.",
  },
  {
    q: 'Can my manager see everything I do?',
    a: 'They see your tasks and how they moved. That is the whole list. No activity tracking, no screenshots, no "online" dots.',
  },
  {
    q: 'What happens to what we say in chat?',
    a: 'It stays a message. Coop may suggest an update based on it, like a possible blocker, and a person has to confirm it before anything changes.',
  },
  {
    q: 'Can we bring our own AI models?',
    a: "It's on the roadmap. The idea is that a person or a whole group can connect their own agent, while Coop's rules stay in charge of what actually gets saved.",
  },
  {
    q: 'Is it ready for my whole company?',
    a: "Coop is early. Boards, dependencies, blockers and history work today. The AI pieces are arriving in stages. If you try it, tell us what's missing. We read everything.",
  },
]

function Faq() {
  return (
    <Section id="faq" className="max-w-4xl">
      <Reveal>
        <h2 className={cn(display, 'text-center text-4xl leading-[1.05] sm:text-6xl')}>
          Fair <span className="italic text-muted">questions.</span>
        </h2>
      </Reveal>
      <div className="mt-12 divide-y divide-line border-y border-line">
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={i * 60}>
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-lg font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line transition-transform duration-300 group-open:rotate-45 group-open:border-accent group-open:text-accent">
                  <Plus className="size-4" />
                </span>
              </summary>
              <p className="mt-3 max-w-2xl animate-enter leading-relaxed text-muted">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ======================================================================= Final CTA + footer */

function FinalCta() {
  const { session } = useAuth()
  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal variant="stop" tilt={-0.5}>
        <div className="grain relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-accent px-6 py-16 text-center text-accent-fg sm:px-12 sm:py-24">
          <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden className="absolute -bottom-32 -left-16 size-80 rounded-full bg-black/10 blur-2xl" />
          <h2 className={cn(display, 'relative text-4xl leading-[1.02] sm:text-7xl')}>
            Your next <span className="whitespace-nowrap">stand-up</span>
            <br />
            <span className="italic opacity-80">could take ten minutes.</span>
          </h2>
          <p className="relative mx-auto mt-6 max-w-lg text-lg opacity-85">Set up a group, add the people you depend on, and let the board do the chasing.</p>
          <div className="relative mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to={session ? '/dashboard' : '/signup'}
              className="group inline-flex items-center gap-2 rounded-2xl bg-surface px-7 py-4 font-medium text-fg shadow-xl transition hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {session ? 'Open your dashboard' : 'Create your workspace'}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {!session && (
              <Link to="/login" className="inline-flex items-center rounded-2xl border border-white/30 px-7 py-4 font-medium transition hover:bg-white/10">
                I already have an account
              </Link>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Footer() {
  const { scrollTo } = useSmoothScroll()
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-5" />
          <span>Coop · for teams who wait on each other</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/login" className="hover:text-fg">
            Sign in
          </Link>
          <Link to="/signup" className="hover:text-fg">
            Create account
          </Link>
          <button onClick={() => scrollTo('#top')} className="hover:text-fg">
            Back to top ↑
          </button>
        </div>
      </div>
    </footer>
  )
}
