'use client';

import { Gamepad2, Crown, ShoppingBag, Package, Users, User } from 'lucide-react';

const tabs = [
  { id: 'play', icon: Gamepad2, label: 'Play' },
  { id: 'vip', icon: Crown, label: 'VIP Arena' },
  { id: 'shop', icon: ShoppingBag, label: 'Shop' },
  { id: 'inventory', icon: Package, label: 'Items' },
  { id: 'friends', icon: Users, label: 'Friends' },
  { id: 'profile', icon: User, label: 'Profile' }
];

export default function BottomNav({ activeTab, setActiveTab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur">
      <div className="container flex justify-around py-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-xs">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
