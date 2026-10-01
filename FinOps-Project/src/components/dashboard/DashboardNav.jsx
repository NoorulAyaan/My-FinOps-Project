import MaterialSymbol from '@/components/MaterialSymbol'

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'grid_view' },
  { id: 'cost', label: 'Cost Analytics', icon: 'monitoring' },
  { id: 'inventory', label: 'Resources', icon: 'inventory_2' },
  { id: 'budgets', label: 'Budgets', icon: 'account_balance_wallet' },
  { id: 'savings', label: 'Savings', icon: 'savings' },
  { id: 'policies', label: 'Policies', icon: 'policy' },
]

export default function DashboardNav({ active, onSelect }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Dashboard sections">
      {NAV.map((item) => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-space-sm rounded-lg px-space-sm py-2 text-left font-title-md text-title-md transition-colors ${
              isActive
                ? 'bg-primary-container/12 text-primary-container'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <MaterialSymbol name={item.icon} className="text-headline-sm" />
            <span className="hidden lg:inline">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
