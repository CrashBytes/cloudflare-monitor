/**
 * Main Layout Component
 * 
 * Application shell with navigation and status indicators
 */

import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Folder, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '../atoms/ConnectionStatus';
import { useMonitoringStore } from '../../stores/monitoringStore';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: Folder },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isConnected, lastUpdated } = useMonitoringStore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <svg className="h-10 w-10" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="cfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#f97316' }} />
                    <stop offset="50%" style={{ stopColor: '#ea580c' }} />
                    <stop offset="100%" style={{ stopColor: '#c2410c' }} />
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="7" fill="url(#cfGrad)" />
                <path
                  d="M 22 16 A 8 8 0 0 1 14 24 A 8 8 0 0 1 6 16 A 8 8 0 0 1 14 8"
                  fill="none"
                  stroke="white"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="25" cy="11" r="1.5" fill="white" opacity="0.9" />
                <circle cx="25" cy="16" r="1.5" fill="white" opacity="0.9" />
                <circle cx="25" cy="21" r="1.5" fill="white" opacity="0.9" />
              </svg>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Cloudflare Monitor</h1>
                <p className="text-xs text-gray-500">Real-time deployment tracking</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-cf-orange/10 text-cf-orange'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Status */}
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <RefreshCw className="h-3 w-3" />
                  <span>Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
                </div>
              )}
              <ConnectionStatus isConnected={isConnected} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>
              Built with ♥ by{' '}
              <a
                href="https://github.com/CrashBytes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cf-orange hover:underline"
              >
                CrashBytes
              </a>
            </p>
            <a
              href="https://github.com/CrashBytes/cloudflare-monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cf-orange transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
