import { useEffect, useRef } from 'react'
import './HeroProductScene.css'

export default function HeroProductScene() {
  const hostRef = useRef(null)

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
    let meshes = []
    let materials = []
    let geometries = []

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
      meshes = []
      materials = []
      geometries = []
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

        const boxSizes = [
          [0.34, 0.34, 0.34],
          [0.24, 0.42, 0.24],
          [0.44, 0.24, 0.24],
          [0.26, 0.26, 0.42],
        ]
        const placements = [
          { x: -1.05, y: 0.48, z: 0, phase: 0.2, drift: 0.035, turn: 0.025 },
          { x: -0.28, y: -0.38, z: -0.2, phase: 1.7, drift: 0.045, turn: 0 },
          { x: 0.48, y: 0.32, z: 0.1, phase: 3.1, drift: 0.03, turn: 0.018 },
          { x: 1.02, y: -0.48, z: -0.15, phase: 4.6, drift: 0.04, turn: 0 },
        ]
        const tokenNames = ['--p', '--p2', '--muted', '--edge']

        placements.forEach((placement, index) => {
          const geometry = new THREE.BoxGeometry(...boxSizes[index])
          const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.position.set(placement.x, placement.y, placement.z)
          mesh.userData = placement
          scene.add(mesh)
          geometries.push(geometry)
          materials.push(material)
          meshes.push(mesh)
        })

        const updateTheme = () => {
          const styles = getComputedStyle(document.documentElement)
          materials.forEach((material, index) => {
            const color = styles.getPropertyValue(tokenNames[index]).trim()
            if (color) material.color.set(color)
          })
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

        const draw = (time) => {
          animationFrame = null
          if (cancelled || document.hidden) return
          const motion = time * 0.00022
          meshes.forEach((mesh) => {
            const { y, phase, drift, turn } = mesh.userData
            mesh.position.y = y + Math.sin(motion + phase) * drift
            if (turn) mesh.rotation.z = Math.sin(motion * 0.6 + phase) * turn
          })
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

  return <div ref={hostRef} className="hero-product-scene" aria-hidden="true" />
}
