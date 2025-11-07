'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ShieldAlert,
  MonitorCog,
  ScrollText // icon for Fraud Detection
} from 'lucide-react';

interface NavigationDrawerProps {
  isOpen: boolean;
  closeDrawer: () => void;
}

interface MenuItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface MenuCategory {
  name: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ isOpen, closeDrawer }) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [activeRoute, setActiveRoute] = useState<string>('');
  const drawerRef = useRef<HTMLDivElement>(null);


  const menuCategories: MenuCategory[] = [
    {
      name: 'Fraud Detection',
      icon: <ShieldAlert className="w-5 h-5" />, 
      items: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Transactions', href: '/transaction' },
        { label: 'Cases', href: '/cases' },
        
      ],
    },
    {
        name:'System',
        icon: <MonitorCog className="w-5 h-5" />, 
        items: [
          { label: 'User', href: '/staff_user' },
         
        ],
    },
    {
      name: 'Reports',
      icon: <ScrollText className="w-5 h-5" />, 
      items: [
        { label: 'Success Rate', href: '/report/success_rate' },
        { label: 'Fraud Analysis', href: '/report/fraud_analysis' },
      ],
    }
  ];


  useEffect(() => {
    setActiveRoute(window.location.pathname);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node) && isOpen) {
        closeDrawer();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeDrawer]);

 
  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));
  };

  const isItemActive = (href: string) => activeRoute === href;

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/40 z-[11]" onClick={closeDrawer} />}

      <div
        ref={drawerRef}
        className={`fixed top-0 left-0 h-screen w-64 bg-slate-950 text-gray-300 z-[12] transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Title */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center text-white">
          <h2 className="font-semibold">Menu</h2>
          <button onClick={closeDrawer} className="text-2xl leading-none">&times;</button>
        </div>

        {/* Navigation */}
        <nav className="py-4 overflow-y-auto space-y-2">
          {menuCategories.map(cat => {
            const expanded = expandedCategories.includes(cat.name);
            const active  = cat.items.some(i => isItemActive(i.href));
            return (
              <div key={cat.name}>
                <button
                  onClick={() => toggleCategory(cat.name)}
                  className={`w-full flex justify-between items-center px-4 py-2 hover:bg-slate-800 ${active ? 'text-white bg-slate-800' : ''}`}
                >
                  <span className="flex items-center gap-2">{cat.icon}{cat.name}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>

                {/* items */}
                <div className={`transition-[max-height] overflow-hidden ${expanded ? 'max-h-96' : 'max-h-0'}`}>
                  {cat.items.map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`block pl-10 pr-4 py-2 hover:bg-red-500 hover:text-white ${isItemActive(item.href) ? 'bg-red-500 text-white' : ''}`}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default NavigationDrawer;
