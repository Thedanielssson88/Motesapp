import { Link, useLocation } from 'react-router-dom';
import { Mic, Users, CheckSquare, Settings, FolderKanban } from 'lucide-react';
import { clsx } from 'clsx';

export const BottomNav = () => {
  const loc = useLocation();
  const navItems = [
    { icon: Mic, label: 'Möten', path: '/' },
    { icon: FolderKanban, label: 'Projekt', path: '/projects' },
    { icon: CheckSquare, label: 'Uppgifter', path: '/tasks' },
    { icon: Users, label: 'Personer', path: '/people' },
    { icon: Settings, label: 'Mer', path: '/settings' },
  ];

  if (loc.pathname === '/record') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe pt-2 px-2 flex justify-between items-center z-50 overflow-x-auto no-scrollbar">
      {navItems.map((item) => {
        const isActive = loc.pathname === item.path || (item.path !== '/' && loc.pathname.startsWith(item.path));
        return (
          <Link key={item.path} to={item.path} className="flex flex-col items-center p-2 min-w-[60px]">
            <item.icon 
              size={22} 
              className={clsx("transition-colors", isActive ? "text-blue-600 fill-blue-100" : "text-gray-400")} 
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span className={clsx("text-[10px] mt-1 font-medium", isActive ? "text-blue-600" : "text-gray-400")}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </div>
  );
};