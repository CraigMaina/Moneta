import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ArrowRightIcon, ChevronRightIcon, LogOutIcon } from '../components/ui/icons'
import { AccountManager } from '../features/settings/AccountManager'
import { CategoryManager } from '../features/settings/CategoryManager'
import { ThemeToggle } from '../features/settings/ThemeToggle'
import { useSignOut } from '../features/settings/useSignOut'
import { SecuritySettings } from '../features/security/SecuritySettings'
import { DeleteAllData } from '../features/security/DeleteAllData'
import { ExportData } from '../features/export/ExportData'
import { useSession } from '../features/auth/useSession'

/**
 * Settings / Account (PRD §7 — manage the app). Quiet sections: Appearance
 * (dark mode), Money (recurring), Accounts, Categories, Security (app lock),
 * Account (identity + sign-out), and a Danger zone (delete all data). Reached
 * from the gear on Home; not a bottom-tab (those stay the five core PRD screens).
 */
export function Settings() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { signOut, signingOut } = useSignOut()

  const email = session?.user?.email ?? null

  return (
    <main className="min-h-dvh bg-paper-0 pb-16">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        <header className="flex items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to home"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-600 hover:bg-paper-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600"
          >
            <ArrowRightIcon className="h-5 w-5 rotate-180" />
          </button>
          <h1 className="font-display text-[22px] font-semibold text-ink-900">Settings</h1>
        </header>

        <Section title="Appearance">
          <ThemeToggle />
        </Section>

        <Section title="Money">
          <Card interactive onClick={() => navigate('/recurring')} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-ink-900">Recurring &amp; bills</p>
              <p className="mt-0.5 text-[12.5px] text-ink-600">Rent, subscriptions, regular income</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-ink-600" />
          </Card>
        </Section>

        <Section title="Accounts">
          <AccountManager />
        </Section>

        <Section title="Categories">
          <CategoryManager />
        </Section>

        <Section title="Security">
          <SecuritySettings />
        </Section>

        <Section title="Data">
          <div className="space-y-3">
            <Card interactive onClick={() => navigate('/import')} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold text-ink-900">Import M-PESA statement</p>
                <p className="mt-0.5 text-[12.5px] text-ink-600">Bring in past transactions from a statement</p>
              </div>
              <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-ink-600" />
            </Card>
            <ExportData />
          </div>
        </Section>

        <Section title="Account">
          <Card>
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">Signed in as</p>
            <p className="mt-1 truncate text-[15px] text-ink-900">{email ?? 'Your account'}</p>
            <Button
              variant="secondary"
              fullWidth
              className="mt-4"
              loading={signingOut}
              onClick={() => void signOut()}
            >
              <LogOutIcon className="h-5 w-5" />
              Sign out
            </Button>
          </Card>
        </Section>

        <Section title="Danger zone">
          <DeleteAllData />
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 text-[12.5px] font-semibold uppercase tracking-wide text-ink-600">{title}</h2>
      {children}
    </section>
  )
}
