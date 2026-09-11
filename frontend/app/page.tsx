import Link from "next/link";

function BasketIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M4.5 9.5h15l-1.15 9.2a2 2 0 0 1-1.98 1.75H7.63a2 2 0 0 1-1.98-1.75L4.5 9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 9.5 10 5m6 4.5L14 5M3.5 9.5h17M9 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M19 10.2c0 5-7 10.3-7 10.3S5 15.2 5 10.2a7 7 0 1 1 14 0Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M6 5.5h.01M18 18.5h.01M6 5.5c0 4.5 12 2.5 12 7.5s-12 3-12 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="1 3.5" />
      <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PlannerPreview() {
  return (
    <div aria-label="Preview of the SmartCart basket planner" className="relative mx-auto w-full max-w-[430px] rotate-0 rounded-[28px] border border-[#cfe1d8] bg-white p-3 shadow-[0_28px_70px_rgba(16,66,52,0.18)] sm:p-4">
      <div className="rounded-[21px] bg-[#f4f8f5] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#698078]">Your basket</p>
            <p className="mt-1 text-lg font-extrabold tracking-[-0.35px] text-[#17362c]">Weekly essentials</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9f0e5] text-[#087f5b]"><BasketIcon /></span>
        </div>

        <div className="mt-5 divide-y divide-[#dce9e2] rounded-2xl border border-[#dfebe5] bg-white px-3">
          {[
            ["Rice", "10 kg", "RM 31.90"],
            ["Eggs", "10 pack", "RM 7.50"],
            ["Cooking oil", "2 kg", "RM 13.90"],
          ].map(([name, size, price]) => (
            <div key={name} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-bold text-[#17362c]">{name}</p>
                <p className="mt-0.5 text-xs text-[#718078]">{size}</p>
              </div>
              <p className="text-sm font-extrabold text-[#17362c]">{price}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-[#087f5b] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#bce9d7]">Best reachable option</p>
              <p className="mt-1 text-sm font-bold">Basket + return trip</p>
            </div>
            <p className="text-xl font-extrabold">RM 61.80</p>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[#d3f0e4]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15"><RouteIcon /></span>
            <span>12 min away · 2.4 km</span>
          </div>
        </div>
      </div>
      <div className="absolute -right-3 -top-3 flex items-center gap-2 rounded-2xl border border-[#f0d8a2] bg-[#fff8e8] px-3 py-2 text-xs font-bold text-[#775a18] shadow-[0_10px_24px_rgba(112,82,16,0.12)] sm:-right-5 sm:-top-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#ffefc4]"><PinIcon /></span>
        Near your location
      </div>
    </div>
  );
}

const steps = [
  { icon: BasketIcon, title: "Build your basket", text: "Add the household essentials you need." },
  { icon: PinIcon, title: "Set your starting point", text: "Choose how far you can travel." },
  { icon: RouteIcon, title: "Compare the real cost", text: "See basket prices and return travel together." },
];

export default function Home() {
  return (
    <main className="min-h-[100svh] overflow-hidden bg-[#f7f8f6] text-[#10231d]">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[1240px] flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
        <header className="flex items-center justify-between gap-4" aria-label="SmartCart header">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-[-0.4px] text-[#10231d]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087f5b] text-white"><BasketIcon /></span>
            SmartCart
          </Link>
          <Link href="/planner" className="rounded-xl px-3 py-2 text-sm font-bold text-[#087f5b] transition-colors hover:bg-[#e5f5ed] focus-visible:bg-[#e5f5ed]">
            Open planner
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-12 pb-8 pt-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.8fr)] lg:gap-20 lg:pb-12 lg:pt-8" aria-labelledby="hero-title">
          <div className="max-w-[610px]">
            <h1 id="hero-title" className="max-w-[650px] text-[clamp(2.6rem,6vw,5.1rem)] font-extrabold leading-[0.98] tracking-[-0.075em] text-[#10231d]">
              Make every trip count.
            </h1>
            <p className="mt-6 max-w-[540px] text-[1.08rem] leading-7 text-[#53635c] sm:text-xl sm:leading-8">
              SmartCart helps you plan an affordable household basket by comparing item prices with the cost and time of getting there.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href="/planner" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#087f5b] px-5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(8,127,91,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5">
                Plan my basket
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="ml-2 h-4 w-4"><path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <span className="text-sm font-medium text-[#718078]">No account needed</span>
            </div>
          </div>

          <div className="relative px-3 py-5 sm:px-8 lg:justify-self-end lg:px-2">
            <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dff1e7] blur-3xl sm:h-[430px] sm:w-[430px]" />
            <PlannerPreview />
          </div>
        </section>

        <section className="border-t border-[#dce5e0] pt-5 sm:pt-6" aria-label="How SmartCart works">
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            {steps.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#087f5b] shadow-[0_4px_12px_rgba(16,66,52,0.06)]"><Icon /></span>
                <div>
                  <h2 className="text-sm font-extrabold text-[#17362c]">{title}</h2>
                  <p className="mt-1 text-sm leading-5 text-[#718078]">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
