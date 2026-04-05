;(function () {
  const menu = document.getElementById('menu')

  let originalW = 0
  let originalH = 0

  window.menuAPI.onInit((data) => {
    document.body.dataset.theme = data.theme
    renderMenu(menu, data.items)

    document.fonts.ready.then(() => {
      const rect = menu.getBoundingClientRect()
      originalW = Math.ceil(rect.width)
      originalH = Math.ceil(rect.height)
      window.menuAPI.resize(originalW, originalH)
    })
  })

  function renderMenu(container, items) {
    container.innerHTML = ''
    items.forEach(item => {
      if (item.type === 'separator') {
        const sep = document.createElement('div')
        sep.className = 'menu-separator'
        container.appendChild(sep)
        return
      }

      const row = document.createElement('div')
      row.className = 'menu-item'

      if (item.enabled === false) {
        row.classList.add('disabled')
      }

      // Check / radio indicator
      if (item.type === 'radio' || item.type === 'checkbox') {
        const check = document.createElement('span')
        check.className = 'menu-item-check'
        if (item.checked) {
          check.textContent = item.type === 'radio' ? '\u25CF' : '\u2713'
        }
        row.appendChild(check)
      }

      // Label
      const label = document.createElement('span')
      label.textContent = item.label
      row.appendChild(label)

      // Submenu
      if (item.type === 'submenu' && item.submenu) {
        row.classList.add('has-submenu')

        const arrow = document.createElement('span')
        arrow.className = 'menu-item-arrow'
        arrow.textContent = '\u25B8'
        row.appendChild(arrow)

        const sub = document.createElement('div')
        sub.className = 'submenu'
        renderMenu(sub, item.submenu)
        row.appendChild(sub)

        // On hover: expand window to fit submenu, flip left if near screen edge
        row.addEventListener('mouseenter', () => {
          const subRect = sub.getBoundingClientRect()
          if (subRect.right > window.screen.availWidth) {
            sub.classList.add('flip-left')
          }
          // Calculate total bounds needed for menu + submenu
          const menuRect = menu.getBoundingClientRect()
          const updatedSubRect = sub.getBoundingClientRect()
          const totalW = Math.ceil(Math.max(menuRect.right, updatedSubRect.right) - Math.min(menuRect.left, updatedSubRect.left))
          const totalH = Math.ceil(Math.max(menuRect.bottom, updatedSubRect.bottom) - Math.min(menuRect.top, updatedSubRect.top))
          window.menuAPI.resize(totalW, totalH)
        })

        row.addEventListener('mouseleave', () => {
          sub.classList.remove('flip-left')
          window.menuAPI.resize(originalW, originalH)
        })
      }

      // Click handler
      if (item.type !== 'submenu') {
        row.addEventListener('click', () => {
          if (item.enabled === false) return
          if (item.id) window.menuAPI.action(item.id)
        })
      }

      container.appendChild(row)
    })
  }

  // Close on blur
  window.addEventListener('blur', () => {
    window.menuAPI.close()
  })

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.menuAPI.close()
    }
  })

  // Color scheme
  window.menuAPI.onColorScheme((data) => {
    if (!data || !data.derived) return
    Object.entries(data.derived).forEach(([k, v]) => document.body.style.setProperty(k, v))
  })
})()
