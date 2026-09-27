const actionLabels = [
  ['all', 'Everyone'],
  ['staff', 'All staff'],
  ['intern', 'All interns'],
  ['none', 'Clear'],
]

function addPickerStyles() {
  if (document.getElementById('workspaceRecipientStyles')) return
  const style = document.createElement('style')
  style.id = 'workspaceRecipientStyles'
  style.textContent = '.workspace-recipient-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.workspace-recipient-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.workspace-recipient-group{min-width:0;padding:13px;border:1px solid #4a445566;border-radius:8px}.workspace-recipient-group h3{display:flex;justify-content:space-between;gap:8px;margin:0 0 9px;font-size:13px}.workspace-recipient-count{color:var(--muted);font:10px JetBrains Mono,monospace}.workspace-recipient-list{max-height:230px;overflow:auto}.workspace-recipient-option{display:flex!important;flex-direction:row!important;align-items:flex-start;gap:8px!important;padding:8px 2px;border-top:1px solid #4a445533;color:var(--text)!important;font:12px Inter,Arial,sans-serif!important;overflow-wrap:anywhere}.workspace-recipient-option input{flex:0 0 auto;margin-top:2px}.workspace-recipient-empty{color:var(--muted);font-size:12px}.workspace-recipient-group button{padding:5px 8px;font-size:10px}@media(max-width:650px){.workspace-recipient-groups{grid-template-columns:1fr}}'
  document.head.append(style)
}

export function createWorkspaceRecipientPicker(root) {
  addPickerStyles()
  root.classList.add('workspace-recipient-picker')
  root.replaceChildren()

  const actions = document.createElement('div')
  actions.className = 'workspace-recipient-actions'
  for (const [action, label] of actionLabels) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'button secondary'
    button.dataset.recipientAction = action
    button.textContent = label
    actions.append(button)
  }

  const groupsRoot = document.createElement('div')
  groupsRoot.className = 'workspace-recipient-groups'
  const lists = {}
  for (const [type, title] of [['staff', 'Staff'], ['intern', 'Interns']]) {
    const group = document.createElement('section')
    group.className = 'workspace-recipient-group'
    const heading = document.createElement('h3')
    heading.textContent = title
    const count = document.createElement('span')
    count.className = 'workspace-recipient-count'
    heading.append(count)
    const list = document.createElement('div')
    list.className = 'workspace-recipient-list'
    lists[type] = { group, count, list }
    group.append(heading, list)
    groupsRoot.append(group)
  }
  root.append(actions, groupsRoot)

  const setChecked = (predicate) => root.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = predicate(box) })
  actions.addEventListener('click', (event) => {
    const action = event.target.closest('[data-recipient-action]')?.dataset.recipientAction
    if (action === 'all') setChecked(() => true)
    if (action === 'staff') setChecked((box) => box.dataset.accountType === 'staff')
    if (action === 'intern') setChecked((box) => box.dataset.accountType === 'intern')
    if (action === 'none') setChecked(() => false)
  })

  return {
    render(recipients) {
      for (const [type, title] of [['staff', 'Staff'], ['intern', 'Interns']]) {
        const { group, count, list } = lists[type]
        const people = recipients.filter((person) => person.accountType === type)
        count.textContent = `${people.length}`
        list.replaceChildren()
        if (!people.length) {
          const empty = document.createElement('p')
          empty.className = 'workspace-recipient-empty'
          empty.textContent = `No active ${title.toLowerCase()} accounts.`
          list.append(empty)
          group.hidden = true
          continue
        }
        group.hidden = false
        for (const person of people) {
          const label = document.createElement('label')
          label.className = 'workspace-recipient-option'
          const checkbox = document.createElement('input')
          checkbox.type = 'checkbox'
          checkbox.value = person.id
          checkbox.dataset.accountType = type
          const details = document.createElement('span')
          details.textContent = [person.name, person.role, person.email].filter(Boolean).join(' · ')
          label.append(checkbox, details)
          list.append(label)
        }
      }
    },
    getSelectedRecipientIds() {
      return [...root.querySelectorAll('input[type="checkbox"]:checked')].map((box) => box.value)
    },
  }
}
