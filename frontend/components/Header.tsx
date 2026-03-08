
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export default function Header() {
    const pathname = usePathname();
    const { address } = useAccount();

    const navLinks = [
        { href: '/', label: 'Home' },
        { href: '/explore', label: 'Explore'},
        { href: '/create', label: 'Create' },
        { href: '/dashboard', label: 'Dashboard', requiresWallet: true },
        { href: '/analytics', label: 'Analytics'},
    ];

    const isActive = (href: string) => {
        if (href === '/') {
            return pathname === '/';
        }
        return pathname.startsWith(href);
    };

     return (
        <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex justify-between items-center">
                    {/* Logo */}
                    <Link href="/" className="flex items-center">
                        <h1 className="text-2xl font-bold tracking-tight font-mono hover:opacity-80 transition-opacity">
                            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                                Crowd
                            </span>
                            <span className="text-white">.Fun</span>
                        </h1>
                    </Link>

                    {/* Navigation Links */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => {
                            // Hide Dashboard if wallet not connected
                            if (link.requiresWallet && !address) {
                                return null;
                            }

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`
                                        px-4 py-2 rounded-lg font-medium transition-all
                                        ${isActive(link.href)
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50'
                                            : 'text-gray-300 hover:text-white hover:bg-white/5'
                                        }
                                    `}
                                >
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Connect Button */}
                    <div className="flex items-center gap-4">
                        <ConnectButton />
                    </div>
                </div>

                {/* Mobile Navigation */}
                <nav className="md:hidden mt-4 flex items-center gap-2 overflow-x-auto pb-2">
                    {navLinks.map((link) => {
                        // Hide Dashboard if wallet not connected
                        if (link.requiresWallet && !address) {
                            return null;
                        }

                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`
                                    flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                                    ${isActive(link.href)
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                                    }
                                `}
                            >

                                {link.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}