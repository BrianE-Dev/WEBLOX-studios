export default function ThemeAwareLogo({ alt = 'WEBLOX Studios' }) {
  return <span className="theme-aware-logo" aria-label={alt}>
    <img className="theme-logo-dark" src="/assets/logo-dark.png" alt={alt} />
    <img className="theme-logo-light" src="/assets/logo-light.png" alt={alt} />
  </span>
}
