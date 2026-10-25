import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function QrCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 480,
      color: { dark: '#122d45', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <div className="mx-auto aspect-square w-full max-w-[280px] rounded-3xl bg-white p-3 shadow-sm" style={{ border: '1px solid var(--border)' }}>
      {src ? (
        <img src={src} alt={label} className="size-full" />
      ) : (
        <div className="size-full animate-pulse rounded-2xl" style={{ background: 'var(--surface-muted)' }} />
      )}
    </div>
  )
}
