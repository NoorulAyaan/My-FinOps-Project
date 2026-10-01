import MaterialSymbol from '@/components/MaterialSymbol'

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'connections', label: 'Cloud accounts', icon: 'hub' },
  { id: 'sessions', label: 'Active sessions', icon: 'devices' },
]

export default function SettingsNav({ active, onSelect }) {
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings sections">
      {SECTIONS.map((section) => {
        const isActive = active === section.id
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-none items-center gap-space-sm whitespace-nowrap rounded-lg px-space-sm py-2 text-left font-title-md text-title-md transition-colors ${
              isActive
                ? 'bg-primary-container/12 text-primary-container'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <MaterialSymbol name={section.icon} className="text-headline-sm" />
            {section.label}
          </button>
        )
      })}
    </nav>
  )
}
