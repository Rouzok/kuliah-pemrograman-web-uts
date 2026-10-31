import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

export default function CompanyProfile() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav aria-label="Company profile" className="flex flex-wrap items-center gap-4 p-6 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded [&_a]:px-3 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-cyan-300 [&_a[aria-current=page]]:underline">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/about">About Us</NavLink>
        <NavLink to="/contact">Contact Us</NavLink>
        <Link to="/map" className="bg-teal-500 font-semibold text-slate-900 hover:bg-teal-400">Live Map</Link>
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
