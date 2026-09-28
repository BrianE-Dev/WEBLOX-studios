import { useEffect, useRef } from 'react'
import './HeroProductScene.css'

const cycleDuration = 2200
const assembleDuration = 500
const separateStart = 1350
const separateDuration = 550

function easeInOut(value) {
  const progress = Math.max(0, Math.min(1, value))
  return progress * progress * (3 - 2 * progress)
}

function mix(from, to, progress) {
  return from + (to - from) * progress
}

export default function HeroProductScene() {
  const hostRef = useRef(null)
  const markRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!host || motionPreference.matches || window.innerWidth <= 900 || document.visibilityState === 'prerender') return undefined

    let cancelled = false
    let renderer
    let animationFrame = null
    let idleCallbackId = null
    let fallbackTimer = null
    let resizeListener
    let visibilityListener
    let motionListener
    let themeObserver
    const geometries = []
    const materials = []

    const stop = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      animationFrame = null
    }

    const cleanup = () => {
      cancelled = true
      stop()
      if (idleCallbackId !== null) window.cancelIdleCallback?.(idleCallbackId)
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer)
      if (resizeListener) window.removeEventListener('resize', resizeListener)
      if (visibilityListener) document.removeEventListener('visibilitychange', visibilityListener)
      if (motionListener) motionPreference.removeEventListener('change', motionListener)
      themeObserver?.disconnect()
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      if (renderer) {
        renderer.dispose()
        renderer.domElement.remove()
      }
    }

    let canvas
    let context
    try {
      canvas = document.createElement('canvas')
      context = canvas.getContext('webgl2')
    } catch {
      return undefined
    }
    if (!context) return undefined

    const loadThree = () => import('three').then((THREE) => {
      if (cancelled) return

      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          context,
          alpha: true,
          antialias: false,
          powerPreference: 'low-power',
        })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
        renderer.setClearColor(0x000000, 0)
        host.appendChild(canvas)

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30)
        camera.position.z = 5.5

        const assembly = new THREE.Group()
        scene.add(assembly)

        const moduleTargets = [
          { x: -0.78, y: 0.5, color: '--p' },
          { x: 0.78, y: 0.5, color: '--p2' },
          { x: -0.78, y: -0.5, color: '--p2' },
          { x: 0.78, y: -0.5, color: '--p' },
        ]
        const moduleOffsets = [
          { x: -1.55, y: 1.05 },
          { x: 1.55, y: 1.05 },
          { x: -1.55, y: -1.05 },
          { x: 1.55, y: -1.05 },
        ]
        const modules = moduleTargets.map((target, index) => {
          const geometry = new THREE.BoxGeometry(0.16, 0.16, 0.08)
          const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.userData = { target, offset: moduleOffsets[index] }
          assembly.add(mesh)
          geometries.push(geometry)
          materials.push(material)
          return mesh
        })

        const updateTheme = () => {
          const styles = getComputedStyle(document.documentElement)
          const isLight = document.documentElement.dataset.theme === 'light'
          modules.forEach((mesh) => {
            const color = styles.getPropertyValue(mesh.userData.target.color).trim()
            if (color) mesh.material.color.set(color)
          })
          if (markRef.current) {
            markRef.current.src = isLight ? '/assets/mini-logo-light.png' : '/assets/mini-logo-dark.png'
          }
        }
        updateTheme()
        themeObserver = new MutationObserver(updateTheme)
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

        const resize = () => {
          if (cancelled) return
          if (window.innerWidth <= 900 || motionPreference.matches) {
            stop()
            return
          }
          const { width, height } = host.getBoundingClientRect()
          if (!width || !height) return
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          renderer.setSize(width, height, false)
        }
        resize()

        let cycleStart = null
        const draw = (time) => {
          animationFrame = null
          if (cancelled || document.hidden) return
          if (cycleStart === null) cycleStart = time
          const elapsed = (time - cycleStart) % cycleDuration
          let assemblyProgress = 0
          if (elapsed < assembleDuration) {
            assemblyProgress = easeInOut(elapsed / assembleDuration)
          } else if (elapsed < separateStart) {
            assemblyProgress = 1
          } else if (elapsed < separateStart + separateDuration) {
            assemblyProgress = 1 - easeInOut((elapsed - separateStart) / separateDuration)
          }

          modules.forEach((mesh) => {
            const { target, offset } = mesh.userData
            mesh.position.set(
              mix(offset.x, target.x, assemblyProgress),
              mix(offset.y, target.y, assemblyProgress),
              0,
            )
          })

          const reveal = easeInOut(elapsed / assembleDuration)
          const fade = 1 - easeInOut((elapsed - separateStart) / 420)
          if (markRef.current) {
            markRef.current.style.opacity = String(0.88 * reveal * fade)
          }

          let pulse = 1
          if (elapsed >= 900 && elapsed < separateStart) {
            const pulseProgress = (elapsed - 900) / (separateStart - 900)
            pulse = 1 + Math.sin(pulseProgress * Math.PI) * 0.035
          }
          assembly.scale.setScalar(pulse)
          if (markRef.current) {
            markRef.current.style.transform = `translate(-50%, -50%) scale(${pulse})`
          }

          try {
            renderer.render(scene, camera)
          } catch {
            cleanup()
            return
          }
          animationFrame = requestAnimationFrame(draw)
        }

        const start = () => {
          if (!cancelled && !document.hidden && !motionPreference.matches && window.innerWidth > 900 && animationFrame === null) {
            animationFrame = requestAnimationFrame(draw)
          }
        }
        resizeListener = () => {
          resize()
          start()
        }
        visibilityListener = () => document.hidden ? stop() : start()
        motionListener = () => motionPreference.matches ? stop() : start()
        window.addEventListener('resize', resizeListener, { passive: true })
        document.addEventListener('visibilitychange', visibilityListener)
        motionPreference.addEventListener('change', motionListener)
        start()
      } catch {
        cleanup()
      }
    }).catch(() => {
      // Three.js is decorative; leave the existing hero preview in place if it fails to load.
    })

    if (window.requestIdleCallback) {
      idleCallbackId = window.requestIdleCallback(loadThree, { timeout: 2000 })
    } else {
      fallbackTimer = window.setTimeout(loadThree, 0)
    }

    return cleanup
  }, [])

  return <div ref={hostRef} className="hero-product-scene" aria-hidden="true">
    <img ref={markRef} className="hero-product-mark" src="/assets/mini-logo-dark.png" alt="" />
  </div>
}
