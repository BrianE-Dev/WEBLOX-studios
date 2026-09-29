import {
  Award,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  FileImage,
  FolderOpen,
  Gauge,
  History,
  Inbox,
  Layers3,
  LayoutDashboard,
  Link2,
  MessageSquareQuote,
  Paintbrush,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react'

const icons = {
  about: UserRound,
  applicants: UsersRound,
  certificates: Award,
  dashboard: LayoutDashboard,
  design: Paintbrush,
  education: Award,
  experience: BriefcaseBusiness,
  highlights: Sparkles,
  history: History,
  images: FileImage,
  inbox: Inbox,
  links: Link2,
  open_source: Layers3,
  overview: Gauge,
  people: UsersRound,
  portfolio: BriefcaseBusiness,
  profile: UserRound,
  projects: FolderOpen,
  repositories: Layers3,
  settings: Settings,
  skills: ChartNoAxesCombined,
  testimonials: MessageSquareQuote,
  tracks: CalendarDays,
}

export default function DashboardNavIcon({ name, size = 18 }) {
  const Icon = icons[name] || ShieldCheck
  return <Icon className="dashboard-nav-icon" size={size} strokeWidth={1.8} aria-hidden="true" focusable="false" />
}

