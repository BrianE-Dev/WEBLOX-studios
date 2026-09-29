import { Blocks, Layers3, Monitor, RefreshCw, ShieldCheck, ShoppingCart, Smartphone, Workflow, Wrench } from 'lucide-react'

const serviceIcons = {
  design: Monitor,
  'web-app': Layers3,
  commerce: ShoppingCart,
  maintenance: Wrench,
  redesign: RefreshCw,
  'custom-app': Blocks,
  mobile: Smartphone,
  automation: Workflow,
  security: ShieldCheck,
}

export default function ServiceIllustration({ kind, title }) {
  const Icon = serviceIcons[kind] || Monitor

  return <div className={`service-illustration service-illustration-${kind}`} role="img" aria-label={`${title} illustration`}>
    <svg className="service-illustration-lines" viewBox="0 0 320 220" fill="none" aria-hidden="true">
      <circle cx="186" cy="108" r="75" stroke={`url(#serviceGlow-${kind})`} strokeWidth="1.5" strokeDasharray="3 8" />
      <circle cx="186" cy="108" r="55" stroke="#a259ff" strokeOpacity=".24" />
      <path d="M45 168h83m64-117h72m-16 128h38" stroke="#b991ff" strokeOpacity=".42" strokeLinecap="round" />
      <rect x="48" y="55" width="57" height="43" rx="8" fill="#a259ff" fillOpacity=".09" stroke="#bd8aff" strokeOpacity=".55" />
      <path d="M60 69h33M60 79h23M60 88h15" stroke="#d8bdff" strokeOpacity=".72" strokeLinecap="round" />
      <rect x="222" y="137" width="51" height="37" rx="8" fill="#37b9ff" fillOpacity=".08" stroke="#75d5ff" strokeOpacity=".55" />
      <path d="M234 150h27m-27 9h18" stroke="#a8e9ff" strokeOpacity=".8" strokeLinecap="round" />
      <circle cx="122" cy="39" r="4" fill="#d1bcff" />
      <circle cx="263" cy="76" r="3" fill="#76ddff" />
      <circle cx="144" cy="190" r="3" fill="#a259ff" />
      <defs>
        <linearGradient id={`serviceGlow-${kind}`} x1="111" y1="33" x2="257" y2="182" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d1bcff" />
          <stop offset="1" stopColor="#42c9ff" />
        </linearGradient>
      </defs>
    </svg>
    <Icon className="service-illustration-icon" strokeWidth={1.35} aria-hidden="true" />
  </div>
}
