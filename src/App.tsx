import { LockGate } from '@/components/LockGate'
import { AppShell } from '@/components/shell/AppShell'

/** WayaMesh web wallet: onboarding and PIN gate, then the five-tab app. */
export default function App() {
  return (
    <LockGate>
      <AppShell />
    </LockGate>
  )
}
