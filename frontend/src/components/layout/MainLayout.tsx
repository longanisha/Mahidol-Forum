import type { ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import './MainLayout.css'

type MainLayoutProps = {
  children: ReactNode
  showHeader?: boolean
  showFooter?: boolean
}

export function MainLayout({
  children,
  showHeader = true,
  showFooter = true,
}: MainLayoutProps) {
  return (
    <div className="layout">
      {showHeader && <Header />}
      <main className="layout__content">{children}</main>
      {showFooter && <Footer />}
    </div>
  )
}


