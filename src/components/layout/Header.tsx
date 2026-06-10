"use client";

import { IconMenu2 } from "@tabler/icons-react";

interface HeaderProps {
  title: string;
  onMenuToggle?: () => void;
}

export default function Header({ title, onMenuToggle }: HeaderProps) {
  return (
    <header className="bg-white border-b border-border px-6 py-4 flex items-center gap-4">
      {onMenuToggle && (
        <button onClick={onMenuToggle} className="lg:hidden p-1 rounded-lg hover:bg-bg-alt">
          <IconMenu2 size={24} className="text-text" />
        </button>
      )}
      <h1 className="text-lg font-semibold text-text">{title}</h1>
    </header>
  );
}
