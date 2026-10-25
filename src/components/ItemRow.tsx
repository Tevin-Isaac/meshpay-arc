import { ArrowDownLeft, ArrowUpRight, ExternalLink, QrCode as QrIcon, Repeat2 } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { fmtUsdc, shortAddress, timeAgo } from '@/lib/format'
import { CHAIN } from '@/lib/mesh'
import type { Role } from '@/lib/items'
import type { StoredItem } from '@/lib/store'
import { Chip } from './ui'

function StatusChip({ item, check }: { item: StoredItem; check?: number }) {
  if (item.status === 'settled') return <Chip tone="good">Settled</Chip>
  if (item.status === 'duplicate') return <Chip>Duplicate</Chip>
  if (item.status === 'expired') return <Chip tone="bad">Expired</Chip>
  if (item.status === 'invalid') return <Chip tone="bad">Invalid</Chip>
  if (check === 0) return <Chip tone="good">Funded</Chip>
  if (check === 5) return <Chip tone="warn">Reserve low</Chip>
  return <Chip>Not yet checked</Chip>
}

export function ItemRow({
  item,
  role,
  check,
  onShowCode,
}: {
  item: StoredItem
  role: Role
  check?: number
  onShowCode?: () => void
}) {
  const amount = fmtUsdc(BigInt(item.amount))
  const Icon = role === 'out' ? ArrowUpRight : role === 'in' ? ArrowDownLeft : Repeat2
  const title =
    role === 'out'
      ? item.kind === 'cashout'
        ? 'Cash out to wallet'
        : `Paid ${shortAddress(item.to)}`
      : role === 'in'
        ? `From ${shortAddress(item.from)}`
        : `Carrying ${shortAddress(item.from)} → ${shortAddress(item.to)}`
  const sign = role === 'out' ? '−' : role === 'in' ? '+' : ''
  const color = role === 'in' && item.status !== 'invalid' ? 'var(--success)' : 'var(--ink)'

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--surface-muted)' }}>
        <Icon className="size-4" style={{ color: 'var(--ink-2)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mono truncate text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
          {title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusChip item={item} check={check} />
          <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>
            {timeAgo(item.createdAt)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <div className="display text-right text-base font-semibold tabular-nums" style={{ color }}>
          {sign}
          {amount}
        </div>
        {item.status === 'pending' && onShowCode && (
          <button
            onClick={onShowCode}
            aria-label="Show payment code"
            className="flex size-11 items-center justify-center rounded-full"
            style={{ color: 'var(--accent-hover)' }}
          >
            <QrIcon className="size-5" />
          </button>
        )}
        {item.status === 'settled' && item.txHash && (
          <a
            href={buildTxExplorerUrl(CHAIN.id, item.txHash)}
            target="_blank"
            rel="noreferrer"
            aria-label="View transaction"
            className="flex size-11 items-center justify-center rounded-full"
            style={{ color: 'var(--accent-hover)' }}
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </li>
  )
}
