import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            P
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              PayPilot AI
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
              PayPal Hackathon 2026
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-xs font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Sandbox Mode</span>
        </div>

        {user && (
          <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                <User className="h-4 w-4" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-slate-200">{user.name}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
