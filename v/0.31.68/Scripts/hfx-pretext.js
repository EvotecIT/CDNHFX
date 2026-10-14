import { layout, prepare } from './pretext.layout.bundle.js'

function parsePx(value, fallback = 0) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseAspectRatio(value, fallback = 0) {
  if (!value) return fallback

  const text = `${value}`.trim()
  if (text.length === 0) return fallback

  if (text.includes('/')) {
    const parts = text.split('/')
    if (parts.length === 2) {
      const width = Number.parseFloat(parts[0])
      const height = Number.parseFloat(parts[1])
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return height / width
      }
    }
  }

  const parsed = Number.parseFloat(text)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getFontFromStyles(styles) {
  if (styles.font && styles.font.length > 0) {
    return styles.font
  }

  return `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} / ${styles.lineHeight} ${styles.fontFamily}`
}

function whenFontsReady(callback) {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(callback).catch(callback)
    return
  }

  callback()
}

function createRafScheduler(callback) {
  let scheduled = false
  return function schedule() {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      callback()
    })
  }
}

function bindWidthControls() {
  const sliders = Array.from(document.querySelectorAll('[data-pretext-width-slider]'))
  for (const slider of sliders) {
    if (!(slider instanceof HTMLInputElement)) continue

    const targetSelector = slider.dataset.target
    if (!targetSelector) continue
    const target = document.querySelector(targetSelector)
    if (!(target instanceof HTMLElement)) continue

    const valueSelector = slider.dataset.value
    const valueLabel = valueSelector ? document.querySelector(valueSelector) : null

    const applyWidth = () => {
      const width = `${slider.value}px`
      target.style.width = width
      if (valueLabel instanceof HTMLElement) valueLabel.textContent = width
      window.dispatchEvent(new Event('resize'))
    }

    slider.addEventListener('input', applyWidth)
    applyWidth()
  }
}

function updatePreparedCache(items, preparedState) {
  const probe = items[0]
  const copyStyles = getComputedStyle(probe.copy)
  const font = getFontFromStyles(copyStyles)
  if (font !== preparedState.font) {
    preparedState.items = items.map(item => prepare(item.copy.textContent || '', font))
    preparedState.font = font
  }

  return copyStyles
}

function initPlaygroundMeasuredAccordion(root) {
  const items = Array.from(root.querySelectorAll('[data-pretext-item]'))
    .map(item => {
      if (!(item instanceof HTMLElement)) return null

      const toggle = item.querySelector('[data-pretext-toggle]')
      const panel = item.querySelector('[data-pretext-panel]')
      const inner = item.querySelector('[data-pretext-inner]')
      const copy = item.querySelector('[data-pretext-copy]')
      const meta = item.querySelector('[data-pretext-meta]')

      if (!(toggle instanceof HTMLButtonElement)) return null
      if (!(panel instanceof HTMLDivElement)) return null
      if (!(inner instanceof HTMLDivElement)) return null
      if (!(copy instanceof HTMLElement)) return null
      if (!(meta instanceof HTMLElement)) return null

      return {
        id: item.dataset.pretextItem || '',
        root: item,
        toggle,
        panel,
        inner,
        copy,
        meta,
      }
    })
    .filter(Boolean)

  if (items.length === 0) return

  let openId = root.dataset.openItem || items[0].id
  const preparedState = { items: [], font: '' }

  const render = () => {
    const copyStyles = updatePreparedCache(items, preparedState)
    const innerStyles = getComputedStyle(items[0].inner)
    const lineHeight = parsePx(copyStyles.lineHeight, Math.round(parsePx(copyStyles.fontSize, 16) * 1.45))
    const paddingY = parsePx(innerStyles.paddingTop) + parsePx(innerStyles.paddingBottom)

    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      const width = item.copy.getBoundingClientRect().width
      if (width <= 0) continue

      const metrics = layout(preparedState.items[index], width, lineHeight)
      const expanded = openId === item.id

      item.meta.textContent = `${metrics.lineCount} lines · ${Math.round(metrics.height)}px`
      item.panel.style.height = expanded ? `${Math.ceil(metrics.height + paddingY)}px` : '0px'
      item.toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false')
      item.root.dataset.expanded = expanded ? 'true' : 'false'
    }

    root.dataset.openItem = openId
  }

  const scheduleRender = createRafScheduler(render)
  for (const item of items) {
    item.toggle.addEventListener('click', () => {
      openId = openId === item.id ? '' : item.id
      scheduleRender()
    })
  }

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(scheduleRender)
    observer.observe(root)
  }

  window.addEventListener('resize', scheduleRender)
  whenFontsReady(scheduleRender)
  scheduleRender()
}

function initBootstrapMeasuredAccordion(root) {
  const items = Array.from(root.querySelectorAll('.accordion-item[data-pretext-item]'))
    .map(item => {
      if (!(item instanceof HTMLElement)) return null

      const toggle = item.querySelector('.accordion-button[data-pretext-toggle]')
      const panel = item.querySelector('.accordion-collapse[data-pretext-panel]')
      const inner = item.querySelector('.accordion-body[data-pretext-inner]')
      const copy = item.querySelector('[data-pretext-copy]')
      const meta = item.querySelector('[data-pretext-meta]')

      if (!(toggle instanceof HTMLButtonElement)) return null
      if (!(panel instanceof HTMLDivElement)) return null
      if (!(inner instanceof HTMLDivElement)) return null
      if (!(copy instanceof HTMLElement)) return null

      return {
        root: item,
        toggle,
        panel,
        inner,
        copy,
        meta: meta instanceof HTMLElement ? meta : null,
      }
    })
    .filter(Boolean)

  if (items.length === 0) return

  const preparedState = { items: [], font: '' }

  const render = () => {
    const copyStyles = updatePreparedCache(items, preparedState)
    const innerStyles = getComputedStyle(items[0].inner)
    const lineHeight = parsePx(copyStyles.lineHeight, Math.round(parsePx(copyStyles.fontSize, 16) * 1.45))
    const paddingX = parsePx(innerStyles.paddingLeft) + parsePx(innerStyles.paddingRight)
    const paddingY = parsePx(innerStyles.paddingTop) + parsePx(innerStyles.paddingBottom)

    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      const liveWidth = item.copy.getBoundingClientRect().width
      const fallbackWidth = Math.max(120, item.root.getBoundingClientRect().width - paddingX)
      const width = liveWidth > 0 ? liveWidth : fallbackWidth
      if (width <= 0) continue

      const metrics = layout(preparedState.items[index], width, lineHeight)
      const predictedHeight = Math.ceil(metrics.height + paddingY)

      if (item.meta) item.meta.textContent = `${metrics.lineCount} lines · ${Math.round(metrics.height)}px`
      item.panel.dataset.pretextHeight = `${predictedHeight}`

      if (item.panel.classList.contains('show') && !item.panel.classList.contains('collapsing')) {
        item.panel.style.height = `${predictedHeight}px`
      }
    }
  }

  const scheduleRender = createRafScheduler(render)

  root.addEventListener('show.bs.collapse', event => {
    const panel = event.target
    if (!(panel instanceof HTMLElement)) return
    if (!root.contains(panel)) return
    panel.style.removeProperty('height')
  })

  root.addEventListener('shown.bs.collapse', event => {
    const panel = event.target
    if (!(panel instanceof HTMLElement)) return
    if (!root.contains(panel)) return
    scheduleRender()
  })

  root.addEventListener('hidden.bs.collapse', event => {
    const panel = event.target
    if (!(panel instanceof HTMLElement)) return
    if (!root.contains(panel)) return
    panel.style.removeProperty('height')
    scheduleRender()
  })

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(scheduleRender)
    observer.observe(root)
  }

  window.addEventListener('resize', scheduleRender)
  whenFontsReady(scheduleRender)
  scheduleRender()
}

function initMeasuredMasonry(root) {
  const cards = Array.from(root.querySelectorAll('[data-pretext-card]'))
    .map(card => {
      if (!(card instanceof HTMLElement)) return null

      const copy = card.querySelector('[data-pretext-card-copy]')
      const metric = card.querySelector('[data-pretext-card-metric]')
      const media = card.querySelector('[data-pretext-card-media]')
      if (!(copy instanceof HTMLElement)) return null
      if (!(metric instanceof HTMLElement)) return null

      return {
        root: card,
        copy,
        metric,
        media: media instanceof HTMLElement ? media : null,
      }
    })
    .filter(Boolean)

  if (cards.length === 0) return

  let prepared = []
  let preparedFont = ''

  const render = () => {
    const containerWidth = root.clientWidth
    if (containerWidth <= 0) return

    const gap = parsePx(root.dataset.gap, 18)
    const minColumnWidth = parsePx(root.dataset.minColWidth, 260)
    const cardPaddingX = parsePx(root.dataset.cardPaddingX, 40)
    const defaultCardChromeY = parsePx(root.dataset.cardChromeY, 132)
    const defaultMediaAspect = parseAspectRatio(root.dataset.cardMediaAspect, 0)

    const copyStyles = getComputedStyle(cards[0].copy)
    const font = getFontFromStyles(copyStyles)
    if (font !== preparedFont) {
      prepared = cards.map(card => prepare(card.copy.textContent || '', font))
      preparedFont = font
    }

    const lineHeight = parsePx(copyStyles.lineHeight, Math.round(parsePx(copyStyles.fontSize, 16) * 1.5))
    const columnCount = Math.max(1, Math.floor((containerWidth + gap) / (minColumnWidth + gap)))
    const columnWidth = (containerWidth - gap * (columnCount - 1)) / columnCount
    const textWidth = Math.max(120, columnWidth - cardPaddingX)
    const columnHeights = new Array(columnCount).fill(0)

    for (let index = 0; index < cards.length; index++) {
      const card = cards[index]
      const metrics = layout(prepared[index], textWidth, lineHeight)

      let shortestColumn = 0
      for (let column = 1; column < columnCount; column++) {
        if (columnHeights[column] < columnHeights[shortestColumn]) shortestColumn = column
      }

      const x = shortestColumn * (columnWidth + gap)
      const y = columnHeights[shortestColumn]
      const cardChromeY = parsePx(card.root.dataset.pretextCardChromeY, defaultCardChromeY)
      const mediaAspect = parseAspectRatio(card.root.dataset.pretextCardMediaAspect, defaultMediaAspect)
      const mediaHeight = mediaAspect > 0 ? Math.round(columnWidth * mediaAspect) : 0
      const cardHeight = Math.ceil(metrics.height + cardChromeY + mediaHeight)

      card.root.style.width = `${columnWidth}px`
      card.root.style.height = `${cardHeight}px`
      card.root.style.transform = `translate(${x}px, ${y}px)`
      card.copy.style.height = `${Math.ceil(metrics.height)}px`
      card.metric.textContent = `${metrics.lineCount} lines · ${Math.round(metrics.height)}px`
      if (card.media) card.media.style.height = mediaHeight > 0 ? `${mediaHeight}px` : ''

      columnHeights[shortestColumn] += cardHeight + gap
    }

    root.style.height = `${Math.max(...columnHeights, 0)}px`
  }

  const scheduleRender = createRafScheduler(render)

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(scheduleRender)
    observer.observe(root)
  }

  window.addEventListener('resize', scheduleRender)
  whenFontsReady(scheduleRender)
  scheduleRender()
}

function boot() {
  bindWidthControls()

  for (const accordion of document.querySelectorAll('[data-hfx-pretext-accordion]')) {
    if (!(accordion instanceof HTMLElement)) continue
    if (accordion.classList.contains('accordion')) {
      initBootstrapMeasuredAccordion(accordion)
    } else {
      initPlaygroundMeasuredAccordion(accordion)
    }
  }

  for (const masonry of document.querySelectorAll('[data-hfx-pretext-masonry]')) {
    if (masonry instanceof HTMLElement) initMeasuredMasonry(masonry)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
