import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const navigate = useNavigate();

  const navItems = [
    { name: 'Live map', path: '/map' },
    { name: 'Airports', path: '/map/airports' },
    { name: 'Saved flights', path: '/map/saved' },
  ];

  return (
    <aside className="relative z-10 flex h-full w-96 flex-col border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 p-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-teal-400 animate-pulse" />
          <h1 className="text-xl font-bold tracking-wide text-teal-400">skytrace</h1>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          Exit
        </button>
      </div>

      {/* Navigasi */}
      <div className="p-3 border-b border-slate-800/80">
        <nav className="flex items-center gap-1 rounded-lg bg-slate-950/60 p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/map'}
              className={({ isActive }) =>
                `flex-1 rounded-md py-1.5 text-center text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Konten Dinamis */}
      <div className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </div>
    </aside>
  );
}