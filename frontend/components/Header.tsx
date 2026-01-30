import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Header() {
    return (
        <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center" >
                <h1 className="text-2xl font-bold tracking-tight font-mono">
                    <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                        Crowd
                    </span>
                    <span className="text-white">.Fun</span>
                </h1>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        padding: 12,
                    }}
                >
                    <ConnectButton />
                </div>
            </div>
        </header>
    );
}