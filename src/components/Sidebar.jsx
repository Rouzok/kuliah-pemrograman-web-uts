import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  const navItems = [
    { name: 'Live map', path: '/map' },
    { name: 'Airports', path: '/map/airports' },
    { name: 'Saved flights', path: '/map/saved' },
  ];

  return (
    <>
      {/* Tombol Reopen / Hamburger (Hanya muncul saat sidebar tertutup) */}
      <button
        onClick={() => setIsOpen(true)}
        className={`absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900/90 text-slate-400 shadow-xl backdrop-blur-md border border-slate-800 hover:text-teal-400 transition-all duration-300 ${
          isOpen ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 pointer-events-auto scale-100'
        }`}
        title="Open Sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
          <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path>
        </svg>
      </button>

      {/* Sidebar Panel dengan Efek Slide In / Slide Out */}
      <aside
        className={`relative z-10 flex h-full w-96 flex-col border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-md transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 p-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-teal-400 animate-pulse" />
            <h1 className="text-xl font-bold tracking-wide text-teal-400">skytrace</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Exit
            </button>
            {/* Tombol Close */}
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-red-400 transition-colors"
              title="Close Sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256">
                <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
              </svg>
            </button>
          </div>
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
    </>
  );
}