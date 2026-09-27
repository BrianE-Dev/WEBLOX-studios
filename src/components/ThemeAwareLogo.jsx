export default function ThemeAwareLogo({ alt = 'WEBLOX Studios' }) {
  return <span className="theme-aware-logo" aria-label={alt}>
    <img className="theme-logo-dark" src="/assets/weblox-logo.png" alt={alt} />
    <img className="theme-logo-light" src="/assets/weblox-logo-light.png" alt={alt} />
  </span>
}
